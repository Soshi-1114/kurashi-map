// reinfolib XKT026 (洪水浸水想定区域) + XKT029 (土砂災害警戒区域) を
// 埼玉県全域でタイル取得し、各市区町村ポリゴンと空間結合して
// hasFloodRisk / hasLandslideRisk を判定する。
//
// メモリ効率化版: タイル単位で逐次処理し、巨大な FeatureCollection を作らない
//
// 実行: node --env-file=.env.local --max-old-space-size=4096 scripts/fetch-hazard.mjs

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync } from "node:fs";
import * as turf from "@turf/turf";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CACHE_DIR = path.join(ROOT, ".cache/reinfolib-tiles");
mkdirSync(CACHE_DIR, { recursive: true });

const KEY = process.env.REINFOLIB_API_KEY;
if (!KEY) {
  console.error("REINFOLIB_API_KEY が未設定");
  process.exit(1);
}

const BASE = "https://www.reinfolib.mlit.go.jp/ex-api/external";
const ZOOM = 14;
const SAITAMA_BBOX = { west: 138.71, south: 35.74, east: 139.91, north: 36.29 };
const FETCH_CONCURRENCY = 4;

function lng2tileX(lng, z) {
  return Math.floor(((lng + 180) / 360) * Math.pow(2, z));
}
function lat2tileY(lat, z) {
  const r = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * Math.pow(2, z),
  );
}
function tileX2lng(x, z) {
  return (x / Math.pow(2, z)) * 360 - 180;
}
function tileY2lat(y, z) {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

function tileBbox(x, y, z) {
  const west = tileX2lng(x, z);
  const east = tileX2lng(x + 1, z);
  const north = tileY2lat(y, z);
  const south = tileY2lat(y + 1, z);
  return [west, south, east, north];
}

function tilesForBbox(bbox, z) {
  const xMin = lng2tileX(bbox.west, z);
  const xMax = lng2tileX(bbox.east, z);
  const yMin = lat2tileY(bbox.north, z);
  const yMax = lat2tileY(bbox.south, z);
  const list = [];
  for (let x = xMin; x <= xMax; x++) {
    for (let y = yMin; y <= yMax; y++) {
      list.push({ x, y });
    }
  }
  return list;
}

function bboxIntersects(a, b) {
  return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
}

async function ensureTile(api, x, y, z) {
  const cachePath = path.join(CACHE_DIR, `${api}_z${z}_x${x}_y${y}.json`);
  if (existsSync(cachePath)) return cachePath;
  const url = new URL(`${BASE}/${api}`);
  url.searchParams.set("response_format", "geojson");
  url.searchParams.set("z", z);
  url.searchParams.set("x", x);
  url.searchParams.set("y", y);
  const res = await fetch(url, { headers: { "Ocp-Apim-Subscription-Key": KEY } });
  let text = "";
  if (res.ok) text = await res.text();
  if (!text.trim()) text = '{"type":"FeatureCollection","features":[]}';
  await fs.writeFile(cachePath, text);
  return cachePath;
}

async function pool(items, n, fn) {
  let i = 0;
  const runners = Array.from({ length: n }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx], idx);
    }
  });
  await Promise.all(runners);
}

async function downloadAllTiles(api) {
  const tiles = tilesForBbox(SAITAMA_BBOX, ZOOM);
  let done = 0;
  await pool(tiles, FETCH_CONCURRENCY, async (t) => {
    await ensureTile(api, t.x, t.y, ZOOM);
    done++;
    if (done % 100 === 0 || done === tiles.length) {
      process.stdout.write(`  ${api}: ${done}/${tiles.length}\r`);
    }
  });
  console.log("");
  return tiles;
}

// muni ポリゴンを準備（与えられた pref のみ）
async function loadMuniPolys() {
  const muniGeo = JSON.parse(await fs.readFile(path.join(ROOT, "public/saitama.geojson"), "utf8"));
  const wardsGeo = JSON.parse(await fs.readFile(path.join(ROOT, "public/saitama_wards.geojson"), "utf8"));
  const all = [...muniGeo.features, ...wardsGeo.features];
  return all.map((f) => ({
    code: String(f.properties?.code ?? ""),
    feat: f,
    bbox: turf.bbox(f),
    hasFlood: false,
    hasLandslide: false,
  }));
}

// タイルを1つずつ読んで、関連 muni ごとに intersect 判定
async function processHazardForApi(api, polys, riskField) {
  const tiles = await downloadAllTiles(api);
  let processed = 0;
  for (const t of tiles) {
    const tb = tileBbox(t.x, t.y, ZOOM); // [w,s,e,n]
    // このタイルbboxと重なる muni をピックアップ（まだflagが立ってないもの優先）
    const candidates = polys.filter((p) => !p[riskField] && bboxIntersects(p.bbox, tb));
    processed++;
    if (processed % 50 === 0) {
      process.stdout.write(`  ${api} check: ${processed}/${tiles.length}, pending munis: ${polys.filter((p) => !p[riskField]).length}\r`);
    }
    if (candidates.length === 0) continue;
    const cachePath = path.join(CACHE_DIR, `${api}_z${ZOOM}_x${t.x}_y${t.y}.json`);
    let fc;
    try {
      const buf = await fs.readFile(cachePath, "utf8");
      fc = JSON.parse(buf);
    } catch { continue; }
    if (!fc?.features?.length) continue;
    // この tile の feature ごとに、未確定 candidate と intersect 判定
    for (const haz of fc.features) {
      let hbbox;
      try { hbbox = turf.bbox(haz); } catch { continue; }
      for (const c of candidates) {
        if (c[riskField]) continue;
        if (!bboxIntersects(c.bbox, hbbox)) continue;
        try {
          if (turf.booleanIntersects(c.feat, haz)) {
            c[riskField] = true;
          }
        } catch {}
      }
      // 全 candidate が確定したら break
      if (!candidates.some((c) => !c[riskField])) break;
    }
    // メモリ解放を促す
    fc = null;
  }
  console.log("");
}

async function main() {
  console.log("Loading muni polygons...");
  const polys = await loadMuniPolys();
  console.log(`  ${polys.length} polygons`);

  console.log("\n[XKT026] 洪水浸水想定区域");
  await processHazardForApi("XKT026", polys, "hasFlood");

  console.log("\n[XKT029] 土砂災害警戒区域");
  await processHazardForApi("XKT029", polys, "hasLandslide");

  // データに反映
  console.log("\nUpdating data files...");
  const muni = JSON.parse(await fs.readFile(path.join(ROOT, "data/saitama.json"), "utf8"));
  const wards = JSON.parse(await fs.readFile(path.join(ROOT, "data/saitama_wards.json"), "utf8"));
  const byCode = new Map();
  for (const m of [...muni, ...wards]) byCode.set(m.code, m);

  for (const p of polys) {
    const target = byCode.get(p.code);
    if (!target) continue;
    const flo = p.hasFlood;
    const lan = p.hasLandslide;
    target.hazard = {
      hasFloodRisk: !!flo,
      hasLandslideRisk: !!lan,
      note: buildNote(flo, lan),
      source: "国土数値情報（reinfolib XKT026/029）",
      asOf: "2024",
    };
  }

  await fs.writeFile(path.join(ROOT, "data/saitama.json"), JSON.stringify(muni, null, 2) + "\n");
  await fs.writeFile(path.join(ROOT, "data/saitama_wards.json"), JSON.stringify(wards, null, 2) + "\n");

  console.log("\n--- sample ---");
  for (const code of ["11100","11107","11203","11369","11363","11208","11215","11206"]) {
    const m = byCode.get(code);
    if (!m) continue;
    console.log(`${code} ${m.name}: flood=${m.hazard.hasFloodRisk} landslide=${m.hazard.hasLandslideRisk}`);
  }
  // 全体統計
  const all = [...muni, ...wards];
  const f = all.filter((m) => m.hazard.hasFloodRisk).length;
  const l = all.filter((m) => m.hazard.hasLandslideRisk).length;
  console.log(`\nTotal: flood=${f}/${all.length}, landslide=${l}/${all.length}`);
}

function buildNote(flood, landslide) {
  const p = [];
  if (flood) p.push("浸水想定区域あり");
  if (landslide) p.push("土砂災害警戒区域あり");
  if (p.length === 0) return "顕著な災害想定区域なし";
  return p.join(" / ");
}

main().catch((e) => { console.error(e); process.exit(1); });
