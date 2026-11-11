// 厚生労働省「医療施設調査」市区町村編の公式CSVから施設数を更新する。
// N1=病院施設数、N2=一般診療所総数+歯科診療所総数（病床数を混ぜない）。
// 配布URLと基準日はversions.mjs。市区町村の5桁コードで照合し、政令市は区を合算。
// CSVの「-」は施設なし=0。対象外の北方領土6村は既存値を保持する。
// 全対象の照合が成功してから保存するため、取得欠損で親市の数を過小更新しない。
// 実行: node scripts/fetch-medical.mjs --all（--pref=mieで単県）
// 原典キャッシュ: MEDICAL_HOSP_CSV / MEDICAL_CLINIC_CSVでローカルCSVを指定可。

import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolvePrefs, PREFS, NORTHERN_TERRITORIES_CODES } from "./_lib/prefs.mjs";
import { loadMuni, saveMuni } from "./_lib/data.mjs";
import { version } from "./_lib/versions.mjs";
import { parseMedicalCsv } from "./_lib/medical.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const SOURCE = version("AMENITIES_SOURCE");
const ASOF = version("AMENITIES_ASOF");

const prefs = resolvePrefs(process.argv.slice(2));

// 1表ぶんを取得し、cat02 の分類名から5桁コードを引いて Map<code, 件数> にする。
async function fetchByMuni(kind, key, file) {
  let buffer;
  if (file) buffer = readFileSync(file);
  else {
    const response = await fetch(version(key), { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(`医療CSV取得失敗: HTTP ${response.status}`);
    buffer = new Uint8Array(await response.arrayBuffer());
  }
  return parseMedicalCsv(buffer, kind, version("MEDICAL_ASOF"));
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
      v = children.reduce((sum, cc) => sum + medical.get(cc), 0);
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
  console.log(`医療施設調査 市区町村編CSV: ${version("MEDICAL_ASOF")}`);
  const [hosp, clinic] = await Promise.all([
    fetchByMuni("hospital", "MEDICAL_HOSP_CSV_URL", process.env.MEDICAL_HOSP_CSV),
    fetchByMuni("clinic", "MEDICAL_CLINIC_CSV_URL", process.env.MEDICAL_CLINIC_CSV),
  ]);
  // 医療機関計 = 病院 + 一般診療所 + 歯科診療所
  const medical = new Map();
  if (hosp.size !== clinic.size || [...hosp.keys()].some((code) => !clinic.has(code))) {
    throw new Error("病院・診療所の地域範囲が一致しません（保存中止）");
  }
  for (const map of [hosp, clinic]) {
    for (const [code, n] of map) medical.set(code, (medical.get(code) ?? 0) + n);
  }
  const total = (m) => [...m.values()].reduce((a, b) => a + b, 0);
  console.log(
    `市区町村 ${medical.size} 件 / 病院 ${total(hosp).toLocaleString()} / ` +
    `一般・歯科診療所 ${total(clinic).toLocaleString()} / ` +
    `計 ${total(medical).toLocaleString()} 施設`,
  );
  // パース失敗（表構成変更等）で全国を過小更新する事故を防ぐ（市区町村は例年 ~1,900 件）。
  if (medical.size < 1500) {
    throw new Error(`市区町村の件数が異常に少ない（${medical.size} 件）。表の構成変更を確認してください`);
  }

  const p2w = parentToWardsAll();
  // 親市の子区欠測を0扱いせず、対象全県を保存前に検査する。
  for (const pref of prefs) {
    const { all } = await loadMuni(ROOT, pref);
    for (const m of all) {
      if (!m.amenities || /対象外|未集計/.test(m.amenities.source)) continue;
      const codes = p2w.get(m.code) ?? [m.code];
      if (codes.some((code) => !medical.has(code)) && !NORTHERN_TERRITORIES_CODES.has(m.code)) {
        throw new Error(`医療施設数が未取得です（保存中止）: ${m.code}`);
      }
    }
  }
  const missing = [];
  for (const pref of prefs) missing.push(...(await applyPref(pref, medical, p2w)));
  if (missing.length) {
    console.log(`表対象外（既存値を保持）: ${missing.length} 自治体 — 北方領土のみが期待値`);
  }
  console.log("data files 保存完了");
}

main().catch((e) => { console.error(e); process.exit(1); });
