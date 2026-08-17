// 国土数値情報「駅別乗降客数 S12」の全国 GeoJSON から駅名検索インデックス
// data/stations.json を生成する。/api/station-search（lib/stationSearch.ts）が
// 駅名 → 自治体＋駅座標を引くための静的データで、クライアントには配信しない
// （towns.json と同じサーバー側専用の2段階配信方針）。
//
// 名寄せ: S12_001g（駅グループコード。同一物理駅の事業者・路線別レコードを束ねる）
// 単位に1駅とし、代表点は最初のフィーチャ（LineString）の重心。自治体コードは
// fetch-stations.mjs と同じく point-in-polygon で割り当てる（政令市は区を優先）。
// 同名・同一自治体の別グループ（例: 東武浅草とTX浅草）は検索上区別できないため
// 1件に併合する。
//
// 事前準備・実行は fetch-stations.mjs と同じ:
//   S12_GEOJSON=/path/to/S12-NN_NumberOfPassengers.geojson node scripts/build-station-index.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import * as turf from "@turf/turf";
import { PREFS, getPref } from "./_lib/prefs.mjs";
import { loadMuniPolys, findPolyForPoint } from "./_lib/reinfolib.mjs";
import { version } from "./_lib/versions.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const GEOJSON_PATH = process.env.S12_GEOJSON || process.argv.find((a) => a.endsWith(".geojson"));
if (!GEOJSON_PATH || !existsSync(GEOJSON_PATH)) {
  console.error(`S12 GeoJSON が見つかりません: ${GEOJSON_PATH ?? "(未指定)"}`);
  console.error("S12_GEOJSON=/path/to/S12-NN_NumberOfPassengers.geojson を指定してください（docs/data-update.md 参照）。");
  process.exit(1);
}

// S12 → 駅グループ単位の [{ name, coords }]。
function loadStationGroups(geojsonPath) {
  const gj = JSON.parse(readFileSync(geojsonPath, "utf8"));
  const groups = new Map();
  for (const f of gj.features ?? []) {
    const p = f.properties ?? {};
    const name = p.S12_001;
    if (!name) continue;
    const key = p.S12_001g ?? p.S12_001c ?? `n:${name}|${p.S12_002 ?? ""}`;
    if (groups.has(key)) continue;
    let coords = null;
    if (f.geometry?.type === "Point") coords = f.geometry.coordinates;
    else {
      try { coords = turf.centroid(f).geometry.coordinates; } catch { continue; }
    }
    if (!coords) continue;
    groups.set(key, { name, coords });
  }
  return [...groups.values()];
}

async function main() {
  const stations = loadStationGroups(GEOJSON_PATH);
  console.log(`S12 駅グループ ${stations.length} 件`);
  // パース失敗（属性名変更等）で激減したインデックスを書き出す事故を防ぐ
  // （fetch-stations.mjs と同じガード。全国の物理駅は ~9,000）。
  if (stations.length < 8000) {
    throw new Error(`駅グループ数が異常に少ない（${stations.length} 件）。S12 の属性・形式変更を確認してください`);
  }

  // 県ごとにポリゴンをロードし、bbox で絞ってから PIP で自治体コードを割り当てる。
  for (const pref of Object.keys(PREFS).map(getPref)) {
    const polys = await loadMuniPolys(ROOT, pref, { wardsFirst: true });
    // 政令市の親（区の dissolve 済みポリゴン）。フォールバックの最近傍判定では
    // 区と親が同じ場所で競合するため、より具体的な区だけを候補にする。
    const parentCodes = new Set(Object.keys(pref.parentToWards ?? {}));
    let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const p of polys) {
      minX = Math.min(minX, p.bbox[0]); minY = Math.min(minY, p.bbox[1]);
      maxX = Math.max(maxX, p.bbox[2]); maxY = Math.max(maxY, p.bbox[3]);
    }
    for (const s of stations) {
      if (s.code) continue;
      const [x, y] = s.coords;
      if (x < minX || x > maxX || y < minY || y > maxY) continue;
      const p = findPolyForPoint(s.coords, polys);
      if (p) {
        s.code = p.code;
        s.dist = 0;
      } else {
        // 簡略化ポリゴンのわずかな外側（海沿い・川沿いの駅）は最近傍ポリゴンへ
        // フォールバック割当する。県境で複数県が候補になり得るため、全県走査後に
        // 最小距離の候補が残るよう dist 付きで上書き判定する。1km 超は誤割当の
        // 恐れがあるため割り当てない（最終的に除外）。
        const [sx, sy] = s.coords;
        for (const cand of polys) {
          if (parentCodes.has(cand.code)) continue;
          const [bx0, by0, bx1, by1] = cand.bbox;
          if (sx < bx0 - 0.02 || sx > bx1 + 0.02 || sy < by0 - 0.02 || sy > by1 + 0.02) continue;
          const d = turf.pointToPolygonDistance(turf.point(s.coords), cand.feat, { units: "kilometers" });
          if (d < 1 && d < (s.dist ?? Infinity)) {
            s.code = cand.code;
            s.dist = d;
          }
        }
      }
    }
  }

  const unassigned = stations.filter((s) => !s.code);
  if (unassigned.length > 0) {
    // ポリゴンから 1km 超離れる駅（原則ないはず）。件数を記録して除外する。
    console.warn(`自治体を割り当てられなかった駅 ${unassigned.length} 件（除外）:`, unassigned.slice(0, 5).map((s) => s.name).join("・"));
  }

  // 同名・同一自治体は1件に併合し、名前順（同名は自治体コード順）で安定出力する。
  const dedup = new Map();
  for (const s of stations) {
    if (!s.code) continue;
    const k = `${s.name}|${s.code}`;
    if (!dedup.has(k)) dedup.set(k, s);
  }
  const list = [...dedup.values()]
    .sort((a, b) => a.name.localeCompare(b.name, "ja") || a.code.localeCompare(b.code))
    .map((s) => [s.name, s.code, +s.coords[0].toFixed(5), +s.coords[1].toFixed(5)]);

  const out = {
    source: "国土数値情報（S12 駅別乗降客数）",
    asOf: version("S12_ASOF"),
    // [駅名（「駅」なし）, 自治体コード（政令市は区）, 経度, 緯度]
    stations: list,
  };
  const outPath = path.join(ROOT, "data", "stations.json");
  writeFileSync(outPath, JSON.stringify(out));
  console.log(`data/stations.json 保存: ${list.length} 駅（同名・同一自治体の併合 ${stations.length - unassigned.length - list.length} 件）`);
}

main().catch((e) => { console.error(e); process.exit(1); });
