// data/*.json のスキーマ検証。fetch スクリプトの出力破損（フィールド欠落・型崩れ・
// コード重複・座標異常）が main にコミットされるのを CI（test.yml）で堰き止める。
// 依存なしの手書きバリデータ。ルールは lib/types.ts の Municipality / 実データの
// 現状に合わせる（値の意味の検証はしない — 欠損センチネル等は honesty 方針でアプリ側が扱う）。
//
// 対象は県別の自治体 JSON（+ wards / shelters）のみ。data/denki-plans.json は
// 型と一緒に lib/denkiPlans.ts の validateDenkiPlans で検証する（npm run test 経由）。
//
// 使い方: node scripts/validate-data.mjs [--pref=saitama]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PREFS, JP_BOUNDS as JP } from "./_lib/prefs.mjs";
import { IPSS_YEARS } from "./_lib/ipss.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const prefArg = process.argv.find((a) => a.startsWith("--pref="))?.slice(7);
const slugs = prefArg ? [prefArg] : Object.keys(PREFS);

const TRENDS = new Set(["増加", "微増", "横ばい", "微減", "減少"]);

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
  if (m.populationChangeRate !== undefined && !isNum(m.populationChangeRate)) {
    err(file, code, "populationChangeRate が数値でない");
  }
  if (m.areaKm2 !== undefined && (!isNum(m.areaKm2) || m.areaKm2 <= 0)) {
    err(file, code, `areaKm2 が正の数値でない (${m.areaKm2})`);
  }
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
  if (m.childcare !== undefined) {
    // 保育所等の定員・利用状況。capacity=0 は「定員なし」の実データ。enrolled は
    // 定員の弾力運用で capacity を超えうるため上限は検証しない。
    for (const k of ["capacity", "enrolled", "capacityAge0", "enrolledAge0", "capacityAge12", "enrolledAge12", "hiddenWaitlist"]) {
      if (!isNum(m.childcare[k]) || m.childcare[k] < 0) err(file, code, `childcare.${k} が非負数値でない`);
    }
    if (isNum(m.childcare.capacity) && isNum(m.childcare.capacityAge0) && isNum(m.childcare.capacityAge12) &&
        m.childcare.capacityAge0 + m.childcare.capacityAge12 > m.childcare.capacity) {
      err(file, code, "childcare の年齢別定員が合計定員を超えている");
    }
    if (!isStr(m.childcare.source)) err(file, code, "childcare.source が空");
    if (!isStr(m.childcare.asOf)) err(file, code, "childcare.asOf が空");
  }
  if (m.vacancy !== undefined) {
    // rate=-1 は対象外センチネル（人口1.5万人未満の町村）。実データは 0〜100 の率。
    if (!isNum(m.vacancy.rate) || (m.vacancy.rate !== -1 && (m.vacancy.rate < 0 || m.vacancy.rate > 100))) {
      err(file, code, `vacancy.rate が不正 (${m.vacancy.rate})`);
    }
    if (!isNum(m.vacancy.vacant) || m.vacancy.vacant < 0) err(file, code, "vacancy.vacant が非負数値でない");
    if (!isNum(m.vacancy.total) || m.vacancy.total < 0) err(file, code, "vacancy.total が非負数値でない");
    if (m.vacancy.rate >= 0 && m.vacancy.total <= 0) err(file, code, "vacancy が実データなのに total が 0");
    if (!isStr(m.vacancy.source)) err(file, code, "vacancy.source が空");
    if (!isStr(m.vacancy.asOf)) err(file, code, "vacancy.asOf が空");
  }
  if (m.futurePopulation !== undefined) {
    const fp = m.futurePopulation;
    const excluded = isStr(fp.source) && fp.source.includes("対象外");
    if (!isNum(fp.base2020)) err(file, code, "futurePopulation.base2020 が数値でない");
    if (!isStr(fp.source)) err(file, code, "futurePopulation.source が空");
    if (!isStr(fp.asOf)) err(file, code, "futurePopulation.asOf が空");
    for (const key of ["young2050", "working2050", "elderly2050"]) {
      if (!isNum(fp[key]) || fp[key] < 0) err(file, code, `futurePopulation.${key} が非負数値でない`);
    }
    if (typeof fp.total !== "object" || fp.total === null) {
      err(file, code, "futurePopulation.total がオブジェクトでない");
    } else if (excluded) {
      // 対象外センチネルは base2020=0・total 空で表現する（0 を実データに見せない）。
      if (fp.base2020 !== 0 || Object.keys(fp.total).length !== 0) {
        err(file, code, "futurePopulation が対象外なのに数値が入っている");
      }
    } else {
      // 実データは 2025〜2050 の5年刻み6時点が揃い、基準人口が正であること。
      if (fp.base2020 <= 0) err(file, code, "futurePopulation が実データなのに base2020 が正でない");
      for (const y of IPSS_YEARS.slice(1)) {
        if (!isNum(fp.total[y]) || fp.total[y] < 0) err(file, code, `futurePopulation.total.${y} が非負数値でない`);
      }
    }
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
console.log(`data 検証 OK: ${slugs.length} 県 ${muniTotal} 自治体（denki-plans.json は npm run test で検証）`);
