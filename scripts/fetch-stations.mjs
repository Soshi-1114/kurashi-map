// 国土数値情報「駅別乗降客数 S12」の全国 GeoJSON から市区町村ごとの駅数を数え、
// data/{pref}.json の amenities.stations を更新する。
// 従来は reinfolib XKT015 経由（quarterly）だったが、reinfolib の反映が原典公開より
// 約1年遅れるため、S12 を直接取り込む方式（annual）へ移行した。
// カウント方法は XKT015 時代と同一: 駅フィーチャ（LineString）の重心を市区町村ポリゴンへ
// point-in-polygon で割り当て、駅コード S12_001c で自治体内の重複を除外する。
// 政令市の親は「区の駅コード集合の和」（区界をまたぐ駅の二重計上を防ぐ）。
//
// 事前（ワークフロー or 手動）: S12 zip を展開して GeoJSON のパスを渡す
//   curl -L -o /tmp/s12.zip "$S12_URL" && unzip -oq /tmp/s12.zip -d /tmp/s12
//   S12_GEOJSON=$(find /tmp/s12/UTF-8 -name '*.geojson' | head -1) \
//     node scripts/fetch-stations.mjs --all
// 実行: --all（全県）/ --pref=saitama（単県）

import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";
import * as turf from "@turf/turf";
import { resolvePrefs } from "./_lib/prefs.mjs";
import { loadMuni, saveMuni } from "./_lib/data.mjs";
import { loadMuniPolys, findPolyForPoint } from "./_lib/reinfolib.mjs";
import { version } from "./_lib/versions.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const SOURCE = version("AMENITIES_SOURCE");
const ASOF = version("AMENITIES_ASOF");

const prefs = resolvePrefs(process.argv.slice(2));

const GEOJSON_PATH = process.env.S12_GEOJSON || process.argv.find((a) => a.endsWith(".geojson"));
if (!GEOJSON_PATH || !existsSync(GEOJSON_PATH)) {
  console.error(`S12 GeoJSON が見つかりません: ${GEOJSON_PATH ?? "(未指定)"}`);
  console.error("S12_GEOJSON=/path/to/S12-NN_NumberOfPassengers.geojson を指定してください（docs/data-update.md 参照）。");
  process.exit(1);
}

// 全国 GeoJSON → [{ coords: [lng,lat], key: 駅コード }]。LineString の重心を駅位置とする。
// S12_001c（駅コード）が無い行は 名前|事業者 でキー代替（XKT015 時代と同じ方針）。
function loadStations(geojsonPath) {
  const gj = JSON.parse(readFileSync(geojsonPath, "utf8"));
  const stations = [];
  for (const f of gj.features ?? []) {
    let coords = null;
    const gt = f.geometry?.type;
    if (gt === "Point") coords = f.geometry.coordinates;
    else {
      try { coords = turf.centroid(f).geometry.coordinates; } catch { continue; }
    }
    if (!coords) continue;
    const p = f.properties ?? {};
    const key = p.S12_001c
      ? `code:${p.S12_001c}`
      : p.S12_001 ? `n:${p.S12_001}|${p.S12_002 ?? ""}` : null;
    if (!key) continue;
    stations.push({ coords, key });
  }
  return stations;
}

async function applyPref(pref, stations) {
  // ward を先に並べると政令市内の駅が区に割り当てられる（fetch-amenities と同じ）。
  const polys = await loadMuniPolys(ROOT, pref, {
    wardsFirst: true,
    decorate: (b) => ({ ...b, keys: new Set() }),
  });
  // 県全体の bbox で全国の駅を先に絞る（PIP の総当たりを避ける）。
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of polys) {
    minX = Math.min(minX, p.bbox[0]); minY = Math.min(minY, p.bbox[1]);
    maxX = Math.max(maxX, p.bbox[2]); maxY = Math.max(maxY, p.bbox[3]);
  }
  const inPref = stations.filter(
    (s) => s.coords[0] >= minX && s.coords[0] <= maxX && s.coords[1] >= minY && s.coords[1] <= maxY,
  );
  const byCode = new Map(polys.map((p) => [p.code, p]));
  for (const s of inPref) {
    const p = findPolyForPoint(s.coords, polys);
    if (p) p.keys.add(s.key);
  }
  // 政令市の親 = 子区の駅コード集合の和
  for (const [parent, children] of Object.entries(pref.parentToWards ?? {})) {
    const parentP = byCode.get(parent);
    if (!parentP) continue;
    for (const cc of children) for (const k of byCode.get(cc)?.keys ?? []) parentP.keys.add(k);
  }

  const { muni, wards, all, paths } = await loadMuni(ROOT, pref);
  let updated = 0, skipped = 0, assigned = 0;
  for (const m of all) {
    if (!m.amenities) continue;
    if (/対象外|未集計/.test(m.amenities.source)) { skipped++; continue; }
    const p = byCode.get(m.code);
    m.amenities.stations = p ? p.keys.size : 0;
    m.amenities.source = SOURCE;
    m.amenities.asOf = ASOF;
    updated++;
    if (p && !Object.hasOwn(pref.parentToWards ?? {}, m.code)) assigned += p.keys.size;
  }
  await saveMuni(paths, muni, wards);
  console.log(`${pref.slug}: 更新 ${updated} / センチネル維持 ${skipped} / 駅（親除く重複込み） ${assigned}`);
  return assigned;
}

async function main() {
  const stations = loadStations(GEOJSON_PATH);
  const uniq = new Set(stations.map((s) => s.key)).size;
  console.log(`S12 駅フィーチャ ${stations.length} 件 / ユニーク駅キー ${uniq} 件`);
  // パース失敗（属性名変更等）で全国 0 駅上書きする事故を防ぐ（全国の駅は ~10,000）。
  if (uniq < 8000) {
    throw new Error(`ユニーク駅数が異常に少ない（${uniq} 件）。S12 の属性・形式変更を確認してください`);
  }
  let total = 0;
  for (const pref of prefs) total += await applyPref(pref, stations);
  console.log(`全県計（自治体割当ベース） ${total} 駅 / data files 保存完了`);
}

main().catch((e) => { console.error(e); process.exit(1); });
