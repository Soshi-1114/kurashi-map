// reinfolib XKT015 (駅)、XKT007 (保育園・幼稚園等) のポイントを取得し、
// 各市区町村ポリゴン内に含まれる数をカウントして amenities フィールドに反映。
// 医療機関（medicalFacilities）は本スクリプトでは更新しない: 原典の国土数値情報 P04 が
// 令和2年度以降更新されないため、毎年公表される厚労省「医療施設調査」（e-Stat）から
// fetch-medical.mjs（annual）が更新する。ここでは既存値を保持する。
//
// 実行: node --env-file=.env.local --max-old-space-size=4096 scripts/fetch-amenities.mjs --pref=saitama

import path from "node:path";
import { fileURLToPath } from "node:url";
import * as turf from "@turf/turf";
import { resolvePref } from "./_lib/prefs.mjs";
import { loadMuni, saveMuni } from "./_lib/data.mjs";
import { createTileFetcher, loadMuniPolys, requireReinfolibKey, findPolyForPoint } from "./_lib/reinfolib.mjs";
import { version } from "./_lib/versions.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const pref = resolvePref(process.argv.slice(2));
console.log(`pref: ${pref.slug} (${pref.nameJa})`);

const KEY = requireReinfolibKey();

const ZOOM = 13;
const tiles = createTileFetcher({
  cacheDir: path.join(ROOT, `.cache/reinfolib-tiles/${pref.slug}`),
  apiKey: KEY,
  zoom: ZOOM,
});

// pref.parentToWards から child→parent map を作る
const CHILD_TO_PARENT = new Map();
for (const [parent, children] of Object.entries(pref.parentToWards ?? {})) {
  for (const c of children) CHILD_TO_PARENT.set(c, parent);
}

async function processApi(api, polys, fieldKey, getKey) {
  const tileList = await tiles.downloadAllTiles(api, polys, { progressEvery: 50 });
  console.log(`  Counting ${api} -> ${fieldKey}`);
  const codeToPoly = new Map(polys.map((p) => [p.code, p]));
  let processed = 0;
  for (const t of tileList) {
    processed++;
    if (processed % 50 === 0) process.stdout.write(`  process: ${processed}/${tileList.length}\r`);
    const fc = await tiles.readTile(api, t.x, t.y);
    if (!fc?.features?.length) continue;
    for (const f of fc.features) {
      let coords = null;
      const gt = f.geometry?.type;
      if (gt === "Point") coords = f.geometry.coordinates;
      else if (gt === "LineString" || gt === "MultiLineString" || gt === "Polygon" || gt === "MultiPolygon") {
        try { coords = turf.centroid(f).geometry.coordinates; } catch { continue; }
      } else continue;
      if (!coords) continue;
      const p = findPolyForPoint(coords, polys);
      if (!p) continue;
      const key = getKey ? getKey(f) : null;
      if (key) { if (p.stationKeys.has(key)) continue; p.stationKeys.add(key); }
      p.counts[fieldKey]++;
      // 政令市親に合算
      const parent = CHILD_TO_PARENT.get(p.code);
      if (parent) {
        const parentP = codeToPoly.get(parent);
        if (parentP) {
          if (key) { if (parentP.stationKeys.has(key)) continue; parentP.stationKeys.add(key); }
          parentP.counts[fieldKey]++;
        }
      }
    }
  }
  console.log("");
}

async function main() {
  // ward を先に並べると政令市内の点が ward に割り当てられる
  const polys = await loadMuniPolys(ROOT, pref, {
    wardsFirst: true,
    decorate: (b) => ({
      ...b,
      counts: { stations: 0, preschools: 0 },
      stationKeys: new Set(),
    }),
  });

  console.log("\n[XKT015] 駅");
  await processApi("XKT015", polys, "stations", (f) => {
    const code = f.properties?.S12_001c;
    if (code) return `code:${code}`;
    const name = f.properties?.S12_001_ja, op = f.properties?.S12_002_ja;
    return name && op ? `n:${name}|${op}` : null;
  });

  console.log("\n[XKT007] 保育園・幼稚園等");
  await processApi("XKT007", polys, "preschools", (f) => {
    const sc = f.properties?.schoolCode;
    if (sc) return `s:${sc}`;
    const n = f.properties?.preSchoolName_ja, loc = f.properties?.location_ja;
    return n ? `p:${n}|${loc ?? ""}` : null;
  });

  const { muni, wards, all, paths } = await loadMuni(ROOT, pref);
  const byCode = new Map(all.map((m) => [m.code, m]));

  for (const p of polys) {
    const t = byCode.get(p.code); if (!t) continue;
    t.amenities = {
      stations: p.counts.stations,
      preschools: p.counts.preschools,
      // 医療機関は fetch-medical.mjs（医療施設調査, annual）由来の値を保持する。
      medicalFacilities: t.amenities?.medicalFacilities ?? 0,
      // 表示ラベルは versions.mjs に集約（fetch-medical.mjs と同期）。
      source: version("AMENITIES_SOURCE"),
      asOf: version("AMENITIES_ASOF"),
    };
  }

  await saveMuni(paths, muni, wards);
}

main().catch((e) => { console.error(e); process.exit(1); });
