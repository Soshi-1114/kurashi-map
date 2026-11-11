// 国土地理院「全国都道府県市区町村別面積調」CSV から市区町村・行政区の面積(km²)を
// 取り込み、data/*.json の areaKm2 に反映する。人口密度は保存せず実行時に
// population / areaKm2 で算出する（lib/populationDensity.ts）。
//
// CSV の形式（Shift_JIS）:
//   標準地域コード, 都道府県, 郡･支庁･振興局等, 市区町村, {最新時点}(k㎡), {最新時点}備考, {旧時点}...
//   - コードは先頭ゼロ落ちの4〜5桁（1100 = 01100 札幌市）→ 5桁ゼロ詰めで突合
//   - 5列目（index 4）が常に最新時点。旧時点列が右に続く
//   - 備考「（参考値）」は境界未定部を持つ自治体の便宜上の概算値（国土地理院の公表値。
//     推計ではなく公表値のためそのまま収録する）
//
// 実行: node scripts/fetch-area.mjs --all   （API キー不要）

import path from "node:path";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolvePrefs } from "./_lib/prefs.mjs";
import { loadAllMuni, saveMuni } from "./_lib/data.mjs";
import { version } from "./_lib/versions.mjs";
import { parseAreaCsv } from "./_lib/area.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const URL = version("MENCHO_URL");
const AS_OF = version("MENCHO_ASOF");

async function fetchAreaMap() {
  // gsi.go.jp は旧式の TLS 再ネゴシエーションを要求し Node fetch(undici) が
  // ERR_SSL_UNSAFE_LEGACY_RENEGOTIATION_DISABLED で失敗するため curl で取得する
  // （nlftp 系スクリプトと同じ方式）。
  const buf = process.env.MENCHO_CSV ? readFileSync(process.env.MENCHO_CSV) : execFileSync("curl", ["-sfL", "-A", "Mozilla/5.0", URL], {
    maxBuffer: 64 * 1024 * 1024,
  });
  const byCode = parseAreaCsv(buf, AS_OF);
  if (byCode.size < 1500) {
    throw new Error(`面積調CSVのパース件数が異常に少ない (${byCode.size}件) — 列構成の変更を確認`);
  }
  return byCode;
}

async function main() {
  const prefs = resolvePrefs(process.argv.slice(2));
  const { entries, byCode, codes } = await loadAllMuni(ROOT, prefs);
  console.log(`対象 ${prefs.length}県 / ${codes.length}自治体 に面積を反映（時点 ${AS_OF}）...`);
  const areaByCode = await fetchAreaMap();
  console.log(`CSV パース: ${areaByCode.size}地域`);

  let filled = 0;
  const missing = [];
  for (const [code, m] of byCode) {
    const area = areaByCode.get(code);
    if (area != null) { m.areaKm2 = area; filled++; }
    else missing.push(`${code} ${m.name}`);
  }
  console.log(`反映 ${filled} / 不明 ${missing.length}`);
  if (missing.length) console.warn("面積が見つからない自治体:", missing.join(", "));

  for (const { paths, muni, wards } of entries) await saveMuni(paths, muni, wards);
  console.log("data files 保存完了");
}

main().catch((e) => { console.error(e); process.exit(1); });
