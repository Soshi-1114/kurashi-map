// こども家庭庁「保育所等関連状況取りまとめ（令和7年4月1日）」のExcelから、
// 指定都道府県の市区町村別 待機児童数を抽出し、data/{pref}.json に反映する。
// シート「資料６－１/６－２」を読むため「（参考）資料1～6」(_r7_02.xlsx)を使う。
//
// 事前: curl -L -o /tmp/cfa_waitlist.xlsx https://www.cfa.go.jp/.../20250828_policies_hoiku_torimatome_r7_02.xlsx
// 実行: node scripts/fetch-waitlist.mjs --pref=saitama   /   --all（全国1ファイルから全県反映）

import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePrefs, PREF_NAMES } from "./_lib/prefs.mjs";
import { resolveXlsxPath, readWorkbook, sheetRows } from "./_lib/xlsx.mjs";
import { loadMuni, saveMuni } from "./_lib/data.mjs";
import { version } from "./_lib/versions.mjs";
import { wardWaitlist } from "./_lib/waitlist.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// 出典の基準時点（令和7年=2025-04-01）。CFA_XLSX_URL とセットで
// scripts/_lib/versions.mjs に集約（URL の年度と asOf が必ず一致するように）。
const CFA_ASOF = version("CFA_ASOF");

const prefs = resolvePrefs(process.argv.slice(2));

const XLSX_PATH = resolveXlsxPath("WAITLIST_XLSX", "/tmp/cfa_waitlist.xlsx");

function extractFromR6(ws) {
  const rows = sheetRows(ws);
  const results = new Map();
  // 県名列の検証は PREF_NAMES（prefs.mjs から導出した正規47都道府県名）で行う。
  for (const r of rows) {
    for (let i = 0; i < r.length - 2; i++) {
      const cell = r[i];
      if (typeof cell !== "string" || !PREF_NAMES.has(cell.trim())) continue;
      const muni = r[i + 1]; const r6 = r[i + 2];
      if (typeof muni !== "string" || typeof r6 !== "number") continue;
      results.set(`${cell.trim()}|${String(muni).trim()}`, r6);
    }
  }
  return results;
}

const META = {
  unit: "人",
  source: "こども家庭庁 保育所等関連状況取りまとめ",
  asOf: CFA_ASOF,
  isEstimated: false,
};

async function applyPref(pref, all) {
  const targetPref = new Map();
  for (const [k, v] of all) {
    const [p, m] = k.split("|");
    if (p === pref.nameJa) targetPref.set(m, v);
  }

  const { muni, wards, paths } = await loadMuni(ROOT, pref);

  let nonZero = 0, zero = 0;
  for (const m of muni) {
    const v = targetPref.get(m.name);
    if (v != null) { m.waitlistChildren = { value: v, ...META }; nonZero++; }
    else { m.waitlistChildren = { value: 0, ...META }; zero++; }
  }

  // 市全体0人なら区も0人。市に待機児童がいる場合、区別の分布は公表されない。
  for (const [parent, children] of Object.entries(pref.parentToWards ?? {})) {
    const p = muni.find((m) => m.code === parent);
    if (!p) continue;
    for (const cc of children) {
      const w = wards.find((x) => x.code === cc);
      if (w) w.waitlistChildren = wardWaitlist(p, CFA_ASOF);
    }
  }

  await saveMuni(paths, muni, wards);
  console.log(`${pref.slug}: 待機児童≠0 ${nonZero} / 0 ${zero}`);
}

async function main() {
  const wb = readWorkbook(XLSX_PATH);
  const sheets = ["資料６－１", "資料６－２"];
  const all = new Map();
  for (const name of sheets) {
    const ws = wb.Sheets[name];
    if (!ws) throw new Error(`待機児童の必須シートがありません（保存中止）: ${name}`);
    const got = extractFromR6(ws);
    for (const [k, v] of got) all.set(k, v);
    console.log(`  ${name}: ${got.size} entries`);
  }
  if (all.size < 100) throw new Error("待機児童の抽出件数が異常です（保存中止）");
  // Excel は1回パース。対象 pref 群へまとめて反映（--all で全国1ファイルから全県）。
  for (const pref of prefs) await applyPref(pref, all);
  console.log("data files 保存完了");
}

main().catch((e) => { console.error(e); process.exit(1); });
