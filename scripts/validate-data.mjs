// data/*.json のスキーマ検証。fetch スクリプトの出力破損（フィールド欠落・型崩れ・
// コード重複・座標異常）が main にコミットされるのを CI（test.yml）で堰き止める。
// 依存なしの手書きバリデータ。ルールは lib/types.ts の Municipality / 実データの
// 現状に合わせる（値の意味の検証はしない — 欠損センチネル等は honesty 方針でアプリ側が扱う）。
//
// 使い方: node scripts/validate-data.mjs [--pref=saitama]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PREFS } from "./_lib/prefs.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const prefArg = process.argv.find((a) => a.startsWith("--pref="))?.slice(7);
const slugs = prefArg ? [prefArg] : Object.keys(PREFS);

const TRENDS = new Set(["増加", "微増", "横ばい", "微減", "減少"]);
// 日本の領域を大きめに囲む座標範囲（避難場所の座標打ち間違い検出用）
const JP = { west: 122, east: 154, south: 20, north: 46 };

const errors = [];
function err(file, code, msg) {
  errors.push(`${file}${code ? ` [${code}]` : ""}: ${msg}`);
}

function isStr(v) {
  return typeof v === "string" && v.length > 0;
}
function isNum(v) {
  return typeof v === "number" && Number.isFinite(v);
}

function checkMetric(file, code, key, m) {
  if (!m || typeof m !== "object") return err(file, code, `${key} がオブジェクトでない`);
  if (!isNum(m.value)) err(file, code, `${key}.value が数値でない`);
  if (!isStr(m.unit)) err(file, code, `${key}.unit が空`);
  if (!isStr(m.source)) err(file, code, `${key}.source が空`);
  if (!isStr(m.asOf)) err(file, code, `${key}.asOf が空`);
  if (typeof m.isEstimated !== "boolean") err(file, code, `${key}.isEstimated が boolean でない`);
}

function checkHazard(file, code, h) {
  if (!h || typeof h !== "object") return err(file, code, "hazard がオブジェクトでない");
  if (typeof h.hasFloodRisk !== "boolean") err(file, code, "hazard.hasFloodRisk が boolean でない");
  if (typeof h.hasLandslideRisk !== "boolean") err(file, code, "hazard.hasLandslideRisk が boolean でない");
  if (!isStr(h.source)) err(file, code, "hazard.source が空");
  if (!isStr(h.asOf)) err(file, code, "hazard.asOf が空");
  for (const k of ["floodLevel", "landslideLevel", "tsunamiLevel", "stormSurgeLevel", "liquefactionLevel"]) {
    if (h[k] !== undefined && !isNum(h[k])) err(file, code, `hazard.${k} が数値でない`);
  }
}

function checkMuni(file, slug, m, level) {
  const code = m?.code ?? "?";
  if (!/^\d{5}$/.test(String(m.code))) err(file, code, "code が5桁数字でない");
  else if (!String(m.code).startsWith(PREFS[slug].code))
    err(file, code, `code が県コード ${PREFS[slug].code} で始まらない`);
  if (m.pref !== slug) err(file, code, `pref が "${slug}" でない (${m.pref})`);
  if (!isStr(m.name)) err(file, code, "name が空");
  if (!isNum(m.population) || m.population < 0) err(file, code, "population が非負数値でない");
  if (!TRENDS.has(m.populationTrend)) err(file, code, `populationTrend が不正 (${m.populationTrend})`);
  for (const key of ["rent", "landPrice", "waitlistChildren", "foreignResidents"]) {
    checkMetric(file, code, key, m[key]);
  }
  checkHazard(file, code, m.hazard);
  if (level === "ward") {
    if (m.level !== "ward") err(file, code, 'wards ファイルなのに level が "ward" でない');
    if (!/^\d{5}$/.test(String(m.parentCode))) err(file, code, "parentCode が5桁数字でない");
  }
  if (m.amenities !== undefined) {
    for (const k of ["stations", "preschools", "medicalFacilities"]) {
      if (!isNum(m.amenities[k]) || m.amenities[k] < 0) err(file, code, `amenities.${k} が非負数値でない`);
    }
    if (!isStr(m.amenities.source)) err(file, code, "amenities.source が空");
    if (!isStr(m.amenities.asOf)) err(file, code, "amenities.asOf が空");
  }
  if (m.shelters !== undefined) {
    if (!isNum(m.shelters.count) || m.shelters.count < 0) err(file, code, "shelters.count が非負数値でない");
    if (!isStr(m.shelters.source)) err(file, code, "shelters.source が空");
    if (!isStr(m.shelters.asOf)) err(file, code, "shelters.asOf が空");
  }
}

function readJson(file) {
  const p = path.join(root, "data", file);
  if (!fs.existsSync(p)) return { missing: true };
  try {
    return { data: JSON.parse(fs.readFileSync(p, "utf8")) };
  } catch (e) {
    err(file, "", `JSON parse 失敗: ${e.message}`);
    return {};
  }
}

let muniTotal = 0;
for (const slug of slugs) {
  if (!PREFS[slug]) {
    err(slug, "", "prefs.mjs に存在しない slug");
    continue;
  }
  const seen = new Set();
  const files = [[`${slug}.json`, "muni"]];
  if (PREFS[slug].hasWards) files.push([`${slug}_wards.json`, "ward"]);

  for (const [file, level] of files) {
    const { data, missing } = readJson(file);
    if (missing) {
      err(file, "", "ファイルが存在しない");
      continue;
    }
    if (!data) continue;
    if (!Array.isArray(data) || data.length === 0) {
      err(file, "", "空または配列でない");
      continue;
    }
    for (const m of data) {
      checkMuni(file, slug, m, level);
      if (seen.has(m.code)) err(file, m.code, "code が重複");
      seen.add(m.code);
    }
    muniTotal += data.length;
  }

  // 避難場所の点データ（存在すれば code → {source, asOf, sites[]} を検証）
  const sf = `${slug}_shelters.json`;
  const { data: sh } = readJson(sf);
  if (sh) {
    if (typeof sh !== "object" || Array.isArray(sh)) {
      err(sf, "", "オブジェクト（code キー）でない");
    } else {
      for (const [code, entry] of Object.entries(sh)) {
        if (!/^\d{5}$/.test(code)) err(sf, code, "キーが5桁コードでない");
        if (!isStr(entry?.source)) err(sf, code, "source が空");
        if (!isStr(entry?.asOf)) err(sf, code, "asOf が空");
        if (!Array.isArray(entry?.sites)) {
          err(sf, code, "sites が配列でない");
          continue;
        }
        for (const s of entry.sites) {
          if (!isNum(s.lng) || !isNum(s.lat) || s.lng < JP.west || s.lng > JP.east || s.lat < JP.south || s.lat > JP.north) {
            err(sf, code, `座標が日本の範囲外: ${s.name} (${s.lng}, ${s.lat})`);
            break; // 同一自治体の座標異常は1件報告すれば十分
          }
        }
      }
    }
  }
}

if (errors.length > 0) {
  const MAX = 50;
  for (const e of errors.slice(0, MAX)) console.error(`ERROR ${e}`);
  if (errors.length > MAX) console.error(`... 他 ${errors.length - MAX} 件`);
  console.error(`\ndata 検証 NG: ${errors.length} 件のエラー`);
  process.exit(1);
}
console.log(`data 検証 OK: ${slugs.length} 県 ${muniTotal} 自治体`);
