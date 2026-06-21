// 初期描画用スケルトン地図（LCP 要素）を生成する。
//
// 全画面地図アプリでは最大要素＝WebGL canvas だが、canvas は LCP の候補要素では
// ないため、ローディング中に「軽量な <img>（このSVG）」を全面表示して LCP を
// 早期に確定させる（MapLibre の初期化完了=TTI に LCP が張り付くのを防ぐ）。
//
// 出典データはリポジトリ内の public/prefectures.geojson（全国の県輪郭）。県レベルの
// 陸/海と海岸線だけを Web Mercator 投影して描き、東京湾の形が分かる軽量スケルトンに
// する。データ更新やブラウザ不要で再現可能。実行: node scripts/build-initial-view-svg.mjs
//
// 表示枠は MapView.tsx の TOKYO_BBOX と整合させ、object-fit:cover でのクロップを
// 見込んで各辺に余白を足した VIEW を投影する。

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// MapView.tsx の TOKYO_BBOX = [138.94, 35.5, 139.92, 35.9]（本土）を各辺に拡張。
// cover で中央クロップされる前提で、周辺県（埼玉/神奈川/千葉）を文脈として含める。
const VIEW = { lonMin: 138.55, latMin: 35.2, lonMax: 140.3, latMax: 36.15 };

const COLOR = {
  water: "#dce5f0",   // 東京湾・海（背景）
  land: "#eef3fc",    // 陸地（家賃コロプレスの淡い青系を示唆）
  border: "rgba(15, 23, 42, 0.12)",
};

const D2R = Math.PI / 180;
const mercX = (lon) => lon * D2R;
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * D2R) / 2));

const X0 = mercX(VIEW.lonMin);
const X1 = mercX(VIEW.lonMax);
const Y0 = mercY(VIEW.latMin);
const Y1 = mercY(VIEW.latMax);
const contentW = X1 - X0;
const contentH = Y1 - Y0;

// アスペクト比を保ったまま高さ1000pxへ。幅は内容比から決める。
const H = 1000;
const W = Math.round((contentW / contentH) * H);

const projX = (lon) => +(((mercX(lon) - X0) / contentW) * W).toFixed(1);
const projY = (lat) => +(((Y1 - mercY(lat)) / contentH) * H).toFixed(1); // SVGはy下向き

const bboxHit = (a, b) =>
  !(a.lonMax < b[0] || a.lonMin > b[2] || a.latMax < b[1] || a.latMin > b[3]);

function ringToPath(ring) {
  let d = "";
  let px = NaN;
  let py = NaN;
  for (const [lon, lat] of ring) {
    const x = projX(lon);
    const y = projY(lat);
    if (x === px && y === py) continue; // 連続重複点を間引いて軽量化
    d += `${d ? "L" : "M"}${x} ${y}`;
    px = x;
    py = y;
  }
  return d ? d + "Z" : "";
}

function featurePath(geom) {
  const polys =
    geom.type === "Polygon" ? [geom.coordinates]
    : geom.type === "MultiPolygon" ? geom.coordinates
    : [];
  let d = "";
  for (const poly of polys) for (const ring of poly) d += ringToPath(ring);
  return d;
}

function featureBbox(geom) {
  let lonMin = Infinity, latMin = Infinity, lonMax = -Infinity, latMax = -Infinity;
  const visit = (c) => {
    if (typeof c[0] === "number") {
      if (c[0] < lonMin) lonMin = c[0];
      if (c[0] > lonMax) lonMax = c[0];
      if (c[1] < latMin) latMin = c[1];
      if (c[1] > latMax) latMax = c[1];
    } else for (const cc of c) visit(cc);
  };
  visit(geom.coordinates);
  return { lonMin, latMin, lonMax, latMax };
}

const geo = JSON.parse(readFileSync(join(ROOT, "public/prefectures.geojson"), "utf8"));
const view = [VIEW.lonMin, VIEW.latMin, VIEW.lonMax, VIEW.latMax];

const paths = [];
for (const f of geo.features) {
  const bb = featureBbox(f.geometry);
  if (!bboxHit(bb, view)) continue;
  const d = featurePath(f.geometry);
  if (d) paths.push(d);
}

const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">` +
  `<rect width="${W}" height="${H}" fill="${COLOR.water}"/>` +
  `<g fill="${COLOR.land}" stroke="${COLOR.border}" stroke-width="1" stroke-linejoin="round">` +
  paths.map((d) => `<path d="${d}"/>`).join("") +
  `</g></svg>`;

const out = join(ROOT, "public/initial-view.svg");
writeFileSync(out, svg);
console.log(`wrote ${out}  (${(svg.length / 1024).toFixed(1)} KB, viewBox ${W}x${H}, ${paths.length} polys)`);
