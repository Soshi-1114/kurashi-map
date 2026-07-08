// 厚生労働省「医療施設調査」（e-Stat）の市区町村別 施設数から、
// data/{pref}.json の amenities.medicalFacilities を更新する。
//   - 第1表 病院数（cdCat01=1 病院施設数）: MEDICAL_HOSP_STATSDATAID
//   - 第2表 一般診療所数・歯科診療所数（cdCat01=100/140 総数）: MEDICAL_CLINIC_STATSDATAID
// 医療機関数 = 病院 + 一般診療所 + 歯科診療所（reinfolib XKT010 / 国土数値情報 P04 と
// 同じ区分）。P04 が令和2年度以降更新されないため、毎年公表される本調査へ移行した。
// statsDataId は年度ごとに新しい表が追加される方式のため versions.mjs で毎年差し替える。
//
// 注意: この統計表の地域軸は標準 area ではなく cat02「二次医療圏・市区町村別」で、
// 分類名（例 "01202 函館市"）に5桁コードが埋め込まれている。県(2桁)・二次医療圏(4桁)の
// 集計行は5桁コードを持たないため自然に除外される。政令市の親は表に無く、区の合算で作る。
// セル値 "-"（該当なし）は 0 として扱う。北方領土6村は表対象外（値は既存のまま保持）。
//
// 実行: node --env-file=.env.local scripts/fetch-medical.mjs --all
//       node --env-file=.env.local scripts/fetch-medical.mjs --pref=saitama

import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePrefs, PREFS } from "./_lib/prefs.mjs";
import { loadMuni, saveMuni } from "./_lib/data.mjs";
import { requireEstatAppId, fetchStatsData } from "./_lib/estat.mjs";
import { version } from "./_lib/versions.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const APP_ID = requireEstatAppId();
const HOSP_ID = version("MEDICAL_HOSP_STATSDATAID");
const CLINIC_ID = version("MEDICAL_CLINIC_STATSDATAID");
const SOURCE = version("AMENITIES_SOURCE");
const ASOF = version("AMENITIES_ASOF");

const prefs = resolvePrefs(process.argv.slice(2));

// 1表ぶんを取得し、cat02 の分類名から5桁コードを引いて Map<code, 件数> にする。
async function fetchByMuni(statsDataId, cdCat01) {
  const sd = await fetchStatsData(APP_ID, statsDataId, { cdCat01 });
  if (!sd) throw new Error(`getStatsData 失敗: ${statsDataId} (cdCat01=${cdCat01})`);
  const cat02 = (sd.CLASS_INF?.CLASS_OBJ ?? []).find((c) => c["@id"] === "cat02");
  const cls = Array.isArray(cat02?.CLASS) ? cat02.CLASS : [cat02?.CLASS].filter(Boolean);
  const nameOf = new Map(cls.map((x) => [x["@code"], x["@name"]]));
  const values = sd.DATA_INF?.VALUE ?? [];
  const byCode = new Map();
  for (const v of Array.isArray(values) ? values : [values]) {
    const m = (nameOf.get(v["@cat02"]) ?? "").match(/^(\d{5})\s/);
    if (!m) continue; // 県・二次医療圏の集計行
    const n = Number(v["$"]);
    byCode.set(m[1], Number.isNaN(n) ? 0 : n); // "-" は該当なし＝0
  }
  return byCode;
}

// 全 pref を跨ぐ「政令市 親コード → 子区コード[]」（fetch-foreign-residents と同方式）。
function parentToWardsAll() {
  const map = new Map();
  for (const slug of Object.keys(PREFS)) {
    const p2w = PREFS[slug].parentToWards ?? {};
    for (const [parent, children] of Object.entries(p2w)) map.set(parent, children);
  }
  return map;
}

async function applyPref(pref, medical, p2w) {
  const { muni, wards, paths } = await loadMuni(ROOT, pref);
  let updated = 0, parents = 0, skipped = 0, missing = [];

  const setFrom = (m) => {
    if (!m.amenities) return; // amenities 未整備の自治体は触らない
    // 「対象外（…）」等のセンチネルは上書きしない（誠実性方針）。
    if (/対象外|未集計/.test(m.amenities.source)) { skipped++; return; }
    const children = p2w.get(m.code);
    let v;
    if (children) {
      // 政令市の親: 表は区単位のみのため区を合算
      v = children.reduce((sum, cc) => sum + (medical.get(cc) ?? 0), 0);
      parents++;
    } else {
      v = medical.get(m.code);
      if (v == null) { missing.push(m.code); return; } // 表対象外（北方領土等）は既存値を保持
    }
    m.amenities.medicalFacilities = v;
    m.amenities.source = SOURCE;
    m.amenities.asOf = ASOF;
    updated++;
  };

  for (const m of muni) setFrom(m);
  for (const w of wards) setFrom(w);

  await saveMuni(paths, muni, wards);
  const miss = missing.length ? ` / 表対象外 ${missing.join(",")}` : "";
  console.log(`${pref.slug}: 更新 ${updated}（うち政令市親 ${parents}） / センチネル維持 ${skipped}${miss}`);
  return missing;
}

async function main() {
  console.log(`医療施設調査: 病院=${HOSP_ID} 診療所=${CLINIC_ID}`);
  const [hosp, clinic, dental] = await Promise.all([
    fetchByMuni(HOSP_ID, "1"),    // 病院施設数
    fetchByMuni(CLINIC_ID, "100"), // 一般診療所数総数
    fetchByMuni(CLINIC_ID, "140"), // 歯科診療所数総数
  ]);
  // 医療機関計 = 病院 + 一般診療所 + 歯科診療所
  const medical = new Map();
  for (const map of [hosp, clinic, dental]) {
    for (const [code, n] of map) medical.set(code, (medical.get(code) ?? 0) + n);
  }
  const total = (m) => [...m.values()].reduce((a, b) => a + b, 0);
  console.log(
    `市区町村 ${medical.size} 件 / 病院 ${total(hosp).toLocaleString()} / ` +
    `一般診療所 ${total(clinic).toLocaleString()} / 歯科 ${total(dental).toLocaleString()} / ` +
    `計 ${total(medical).toLocaleString()} 施設`,
  );
  // パース失敗（表構成変更等）で全国を過小更新する事故を防ぐ（市区町村は例年 ~1,900 件）。
  if (medical.size < 1500) {
    throw new Error(`市区町村の件数が異常に少ない（${medical.size} 件）。表の構成変更を確認してください`);
  }

  const p2w = parentToWardsAll();
  const missing = [];
  for (const pref of prefs) missing.push(...(await applyPref(pref, medical, p2w)));
  if (missing.length) {
    console.log(`表対象外（既存値を保持）: ${missing.length} 自治体 — 北方領土のみが期待値`);
  }
  console.log("data files 保存完了");
}

main().catch((e) => { console.error(e); process.exit(1); });
