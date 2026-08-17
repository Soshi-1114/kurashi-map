// 国土数値情報 N03（行政区域）から public/{slug}.geojson（+ 政令市は
// {slug}_wards.geojson）の「ジオメトリだけ」を再生成する。data/*.json には触れない
// （build-base.mjs は skeleton データも書くため、既存県への再実行は実データを壊す）。
//
// build-base.mjs の turf.simplify は自治体ポリゴンごとに独立へ簡略化するため、
// 隣接自治体の共有境界が別々の折れ線になり、拡大時に隙間（穴）や重なりが出ていた。
// ここでは mapshaper のトポロジー保存簡略化（共有境界を1本のアークとして簡略化）に
// 置き換えて、これを構造的に解消する。政令市の親は区の dissolve で作る（区界と
// 親の外周が完全一致する）。
//
// 事前（build-base.mjs と同じ）:
//   curl -sL -o /tmp/N03_{code}.zip "https://nlftp.mlit.go.jp/ksj/gml/data/N03/N03-2024/N03-20240101_{code}_GML.zip"
//   unzip -o -q /tmp/N03_{code}.zip -d /tmp/N03_{code}
// 実行:
//   node --max-old-space-size=8192 scripts/rebuild-geometry.mjs --pref=tokyo
//   INTERVAL で簡略化間隔（m）を調整（既定 30。build-base の旧 tolerance は約50m相当）
import fs from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mapshaper from "mapshaper";
import * as turf from "@turf/turf";
import { resolvePref } from "./_lib/prefs.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const pref = resolvePref(process.argv.slice(2));
// 簡略化解像度（m）。%指定は県ごとの相対値になり、内陸の高密度県（例: 大阪の区界）が
// 過剰簡略化されるため、固定間隔を既定とする。30m ≒ z14 で約3px の誤差
// （旧 build-base の tolerance 0.0006° ≒ 50m 超 + 隣接不一致より大幅に良い）。
const SIMPLIFY = `interval=${Number(process.env.INTERVAL || 30)}`;

const N03_DIR = process.env.N03_DIR || `/tmp/N03_${pref.code}`;
if (!existsSync(N03_DIR)) {
  console.error(`N03 ディレクトリが無い: ${N03_DIR}（build-base.mjs ヘッダの手順で DL）`);
  process.exit(1);
}
const geojsonName = readdirSync(N03_DIR).find((f) => f.endsWith(".geojson"));
if (!geojsonName) { console.error(`N03 geojson が無い: ${N03_DIR}`); process.exit(1); }

async function main() {
  const raw = JSON.parse(await fs.readFile(path.join(N03_DIR, geojsonName), "utf8"));

  const parentOf = new Map();
  for (const [parent, wards] of Object.entries(pref.parentToWards || {})) {
    for (const w of wards) parentOf.set(w, parent);
  }

  // N03 の生ポリゴン（飛び地ごとに1フィーチャ）に、dissolve 用のキーを付けて入力を作る。
  // 抽出条件は build-base.mjs と同一（不正コード・所属未定地の除外、名前の解決）。
  const pieces = [];
  for (const f of raw.features) {
    const p = f.properties;
    const code = String(p.N03_007 ?? "");
    if (!code || code.length !== 5) continue;
    if (p.N03_004 === "所属未定地" || code.endsWith("000")) continue;
    if (!f.geometry) continue;
    const isWard = parentOf.has(code);
    pieces.push({
      type: "Feature",
      properties: {
        code,
        // muni レイヤーの dissolve キーと名前（政令市の区は親コード・市名に集約）。
        // wardName の有無が「区かどうか」を兼ねる（wards レイヤーの filter 条件）。
        muniCode: parentOf.get(code) ?? code,
        muniName: p.N03_004 || p.N03_003 || code,
        wardName: isWard ? (p.N03_005 || p.N03_004 || code) : "",
      },
      geometry: f.geometry,
    });
  }
  console.log(`${pref.slug}: N03 pieces ${pieces.length}`);

  // 1つのデータセットとして簡略化（muni と wards が同じアークを共有するため、
  // ズーム切替でも境界が一致する）。dissolve2 は簡略化後に行う。
  // 出力精度は小数5桁（≒1.1m）。6桁だと gzip 後で 15%超膨らむ一方、30m 簡略化に
  // 対して 1m 未満の丸めは視覚上区別できない。
  const PRECISION = "precision=0.00001";
  const input = JSON.stringify({ type: "FeatureCollection", features: pieces });
  const commands = [
    `-i src.json name=src`,
    `-simplify ${SIMPLIFY} keep-shapes`,
    // 区のない県では wards パイプライン（filter/dissolve/出力）を丸ごと省く
    ...(pref.hasWards ? [
      `-filter "wardName !== ''" + name=wardsrc`,
      `-dissolve2 code copy-fields=wardName target=wardsrc name=wards`,
    ] : []),
    `-dissolve2 muniCode copy-fields=muniName target=src name=muni`,
    `-o out_muni.json target=muni format=geojson ${PRECISION}`,
    ...(pref.hasWards ? [`-o out_wards.json target=wards format=geojson ${PRECISION}`] : []),
  ].join(" ");
  const out = await mapshaper.applyCommands(commands, { "src.json": input });

  // 微小島嶼の除去。keep-shapes は全島を保持するため、東京（伊豆・小笠原の岩礁）の
  // ようにピースが数千あるとサイズが数倍に膨らむ。旧実装（簡略化で潰れたリングを
  // 除去）に合わせ、面積が MIN_RING_AREA 未満のポリゴンを落とす。自治体そのものが
  // 消えないよう、全ポリゴンがしきい値未満の場合は最大の1つを残す。
  const MIN_RING_AREA = Number(process.env.MIN_RING_AREA || 20000); // m²（~140m四方）
  const filterTinyIslands = (mpCoords) => {
    const withArea = mpCoords.map((poly) => {
      let area = 0;
      try { area = turf.area(turf.polygon(poly)); } catch { /* 不正リングは面積0扱い */ }
      return { poly, area };
    });
    const kept = withArea.filter((p) => p.area >= MIN_RING_AREA).map((p) => p.poly);
    if (kept.length > 0) return kept;
    return [withArea.reduce((a, b) => (b.area > a.area ? b : a)).poly];
  };

  const toFeatures = (json, codeField, nameField) => {
    const fc = JSON.parse(json.toString());
    return fc.features
      .map((f) => {
        const mp = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
        return {
          type: "Feature",
          properties: { name: f.properties[nameField], code: f.properties[codeField] },
          geometry: { type: "MultiPolygon", coordinates: filterTinyIslands(mp) },
        };
      })
      .sort((a, b) => a.properties.code.localeCompare(b.properties.code));
  };
  const muniFeatures = toFeatures(out["out_muni.json"], "muniCode", "muniName");
  const wardFeatures = pref.hasWards ? toFeatures(out["out_wards.json"], "code", "wardName") : [];

  // 既存ファイルとコード集合が完全一致することを検証（自治体の欠落・混入を防ぐ）
  const assertSameCodes = async (geoPath, feats) => {
    const prev = JSON.parse(await fs.readFile(geoPath, "utf8"));
    const before = new Set(prev.features.map((f) => String(f.properties.code)));
    const after = new Set(feats.map((f) => f.properties.code));
    const missing = [...before].filter((c) => !after.has(c));
    const extra = [...after].filter((c) => !before.has(c));
    if (missing.length || extra.length) {
      throw new Error(`${path.basename(geoPath)} のコード不一致 missing=[${missing}] extra=[${extra}]`);
    }
  };

  const muniGeoPath = path.join(ROOT, "public", `${pref.slug}.geojson`);
  const wardsGeoPath = path.join(ROOT, "public", `${pref.slug}_wards.geojson`);
  await assertSameCodes(muniGeoPath, muniFeatures);
  if (pref.hasWards) await assertSameCodes(wardsGeoPath, wardFeatures);

  // 既存ファイルと同じ体裁（1 feature 1 行）で書き出す
  const writeGeo = async (p, feats) => {
    const body = feats.map((f) => "  " + JSON.stringify(f)).join(",\n");
    await fs.writeFile(p, `{"type":"FeatureCollection", "features": [\n${body}\n]}\n`);
    const kb = Math.round((await fs.stat(p)).size / 1024);
    console.log(`✓ ${path.relative(ROOT, p)} (${feats.length} features, ${kb}KB)`);
  };
  await writeGeo(muniGeoPath, muniFeatures);
  if (pref.hasWards) await writeGeo(wardsGeoPath, wardFeatures);
}

main().catch((e) => { console.error(e); process.exit(1); });
