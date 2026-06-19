// public/*.geojson のサイズ最適化（パフォーマンス用）。
//  - turf.simplify で頂点を間引く（関東7県＋prefecturesは未簡略化なので効果大）
//  - 座標を5桁(≈1m)に丸め、連続重複点を除去
// data には触れない。表示は最大 z13.5 なのでこの精度で見た目はほぼ不変。
//
// 実行: node --max-old-space-size=4096 scripts/optimize-geojson.mjs

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as turf from "@turf/turf";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.resolve(__dirname, "../public");

const P = 1e5; // 5桁
const r1 = (n) => Math.round(n * P) / P;

function roundDedupRing(ring) {
  const out = [];
  for (const pt of ring) {
    const p = [r1(pt[0]), r1(pt[1])];
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  // リングを閉じる
  if (out.length && (out[0][0] !== out[out.length - 1][0] || out[0][1] !== out[out.length - 1][1])) {
    out.push([out[0][0], out[0][1]]);
  }
  return out.length >= 4 ? out : null; // 退化リングは捨てる
}

function cleanPolygon(poly) {
  const rings = poly.map(roundDedupRing).filter(Boolean);
  return rings.length ? rings : null; // 外周が消えたら null
}

function cleanGeometry(geom) {
  if (geom.type === "Polygon") {
    const c = cleanPolygon(geom.coordinates);
    return c ? { type: "Polygon", coordinates: c } : null;
  }
  if (geom.type === "MultiPolygon") {
    const polys = geom.coordinates.map(cleanPolygon).filter(Boolean);
    return polys.length ? { type: "MultiPolygon", coordinates: polys } : null;
  }
  return geom;
}

function simplify(feature, tolerance) {
  try {
    return turf.simplify(feature, { tolerance, highQuality: false, mutate: true });
  } catch {
    return feature; // 失敗時は原形
  }
}

async function optimizeFile(name) {
  const fp = path.join(PUB, name);
  const before = (await fs.stat(fp)).size;
  const g = JSON.parse(await fs.readFile(fp, "utf8"));
  // prefectures は低ズーム専用なので強めに簡略化
  const tol = name === "prefectures.geojson" ? 0.0025 : 0.0006;
  const out = [];
  for (const f of g.features) {
    if (!f.geometry) { out.push(f); continue; }
    const orig = f.geometry;
    // 簡略化は破壊的(mutate)なので原形はディープコピーから
    const copy = { type: "Feature", properties: {}, geometry: JSON.parse(JSON.stringify(orig)) };
    const simplified = simplify(copy, tol);
    // フィーチャは絶対に落とさない: 簡略化→精度丸めのみ→原形 の順でフォールバック
    let geom = cleanGeometry(simplified.geometry) || cleanGeometry(orig) || orig;
    out.push({ type: "Feature", properties: f.properties, geometry: geom });
  }
  const body = out.map((f) => "  " + JSON.stringify(f)).join(",\n");
  await fs.writeFile(fp, `{"type":"FeatureCollection", "features": [\n${body}\n]}\n`);
  const after = (await fs.stat(fp)).size;
  return { name, before, after, feats: `${g.features.length}→${out.length}` };
}

async function main() {
  const files = (await fs.readdir(PUB)).filter((f) => f.endsWith(".geojson"));
  let tb = 0, ta = 0;
  for (const f of files) {
    const r = await optimizeFile(f);
    tb += r.before; ta += r.after;
    console.log(`${r.name.padEnd(24)} ${(r.before / 1024 | 0)}KB → ${(r.after / 1024 | 0)}KB  feats ${r.feats}`);
  }
  console.log(`\n合計 ${(tb / 1024 / 1024).toFixed(1)}MB → ${(ta / 1024 / 1024).toFixed(1)}MB  (${(100 - ta / tb * 100) | 0}%減)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
