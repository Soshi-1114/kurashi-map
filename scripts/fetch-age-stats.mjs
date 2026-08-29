// 総務省「住民基本台帳に基づく人口、人口動態及び世帯数調査」の市区町村別年齢階級別
// 人口【総計】Excel から、0-14歳・65歳以上・総人口を抽出し data/{pref}.json の
// ageStats に反映する。高齢化率・年少人口比は保存せず実行時算出（lib/ageStats.ts）。
//
// 出典の性質（2026-01-01 版で実ファイル確認済み）:
// - 単一シート。行1=年齢階級見出し（総数・0歳～4歳 … 100歳以上の5歳階級21区分）、
//   行2=「団体コード/都道府県名/市区町村名/性別」+単位行。データは1自治体につき
//   計/男/女の3行で、「計」行のみ処理する。
// - 団体コードは6桁（チェックデジット付き）。末尾1桁を落とした5桁が Municipality.code
//   に一致する。政令市の区別行もあるため、政令市の合算・展開は不要。
// - 県行・郡行（市区町村名 "-" 等）はコード突合で自然に除外される。
// - 北方領土6村は行が存在するが全列0 → total=0 センチネル（住民登録なし）を書き、
//   ETL 未実行（フィールド欠落）と区別する。
// - 列位置は年度で変わり得るため、見出し文字列から動的に解決する（固定indexにしない）。
//
// 事前: curl -sL -o /tmp/juki_age.xlsx \
//   "https://www.e-stat.go.jp/stat-search/file-download?statInfId=${JUKI_AGE_STATINFID}&fileKind=0"
// 実行: node scripts/fetch-age-stats.mjs --pref=saitama / --all

import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import * as fs from "node:fs";
import XLSX from "xlsx";
import { resolvePrefs } from "./_lib/prefs.mjs";

// xlsx の ESM ビルド（xlsx.mjs）は fs を自動注入しないため、readFile 前に明示的に渡す。
XLSX.set_fs?.(fs);
import { loadMuni, saveMuni } from "./_lib/data.mjs";
import { version } from "./_lib/versions.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const ASOF = version("JUKI_ASOF");
const SOURCE = "総務省 住民基本台帳に基づく人口・世帯数調査（総計・外国人住民含む）";
// 住民登録がない自治体（北方領土6村）のセンチネル。hasAgeData（total>0）が偽になる。
const NODATA = { young: 0, elderly: 0, total: 0, source: "データなし（住民登録なし）", asOf: "-" };

const prefs = resolvePrefs(process.argv.slice(2));

const XLSX_PATH = process.env.JUKI_XLSX ||
  process.argv.find((a) => a.endsWith(".xlsx")) ||
  "/tmp/juki_age.xlsx";
if (!existsSync(XLSX_PATH)) {
  console.error(`Excel not found: ${XLSX_PATH}`);
  process.exit(1);
}

// 年齢階級見出し行から列インデックスを解決する。「NN歳～NN歳」「100歳以上」の
// 先頭数値で年少（<=14）・高齢（>=65）を判定し、様式変更（列の増減）に耐える。
function resolveColumns(headerRow) {
  let total = -1;
  const young = [];
  const elderly = [];
  for (let i = 0; i < headerRow.length; i++) {
    const label = String(headerRow[i] ?? "").trim();
    if (label === "総数") { total = i; continue; }
    const m = /^(\d+)歳/.exec(label);
    if (!m) continue;
    const age = Number(m[1]);
    if (age <= 14) young.push(i);
    else if (age >= 65) elderly.push(i);
  }
  // 期待: 総数1列・年少3階級（0-4/5-9/10-14）・高齢8階級（65-69〜100歳以上）
  if (total < 0 || young.length !== 3 || elderly.length !== 8) {
    throw new Error(
      `年齢階級見出しの解決に失敗（総数=${total} 年少=${young.length}列 高齢=${elderly.length}列）。様式変更を確認してください`,
    );
  }
  return { total, young, elderly };
}

function sumCols(row, cols) {
  let total = 0;
  for (const i of cols) if (typeof row[i] === "number") total += row[i];
  return total;
}

// Excel 全体を「5桁コード → {young, elderly, total}」に読み込む。
function extract() {
  const wb = XLSX.readFile(XLSX_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, raw: true });

  // 見出し行を探す: 「団体コード」で始まる行の1つ上が年齢階級見出し。
  const unitRowIdx = rows.findIndex((r) => String(r?.[0] ?? "").trim() === "団体コード");
  if (unitRowIdx < 1) throw new Error("「団体コード」見出し行が見つかりません（様式変更?）");
  const cols = resolveColumns(rows[unitRowIdx - 1]);

  const out = new Map();
  let national = null;
  for (let i = unitRowIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (r[3] !== "計") continue;
    // 全国合計行（団体コード "-"・都道府県名 "合計"）は検算用に保持。
    if (r[1] === "合計") { national = r[cols.total]; continue; }
    const code6 = String(r[0] ?? "").trim();
    if (!/^\d{6}$/.test(code6)) continue; // 県・郡行など
    const young = sumCols(r, cols.young);
    const elderly = sumCols(r, cols.elderly);
    const total = typeof r[cols.total] === "number" ? r[cols.total] : 0;
    if (young + elderly > total) {
      throw new Error(`検算エラー: ${code6} で 年少+高齢(${young + elderly}) > 総数(${total})`);
    }
    out.set(code6.slice(0, 5), { young, elderly, total });
  }

  // 表構成変更で全国を過小更新する事故を防ぐ。表には都道府県行（6桁コードの
  // 市区町村部が "000"）も含まれ out に入るが、5桁化コードが自治体コードに一致
  // しないため書き込みには使われない。全国との突合は適用側（main）で行う。
  if (out.size < 1800) throw new Error(`抽出件数が異常に少ない（${out.size} 件）。様式変更を確認してください`);
  console.log(`抽出 ${out.size} 行（都道府県行を含む）`);
  return { byCode5: out, national };
}

async function applyPref(pref, byCode5) {
  const { muni, wards, all, paths } = await loadMuni(ROOT, pref);

  let hit = 0, nodata = 0, muniTotal = 0;
  for (const m of all) {
    const v = byCode5.get(m.code);
    if (v && v.total > 0) {
      m.ageStats = { ...v, source: SOURCE, asOf: ASOF };
      hit++;
    } else {
      // 表に行がない・総数0（北方領土6村）→ センチネル（ETL 実行済みの明示）。
      m.ageStats = { ...NODATA };
      nodata++;
    }
  }
  // 全国突合用: 区を除いた市区町村の総人口（区を足すと政令市が二重計上になる）。
  for (const m of muni) muniTotal += byCode5.get(m.code)?.total ?? 0;

  await saveMuni(paths, muni, wards);
  console.log(`${pref.slug}: ageStats ${hit} / データなし ${nodata}`);
  return muniTotal;
}

async function main() {
  const { byCode5, national } = extract();
  let applied = 0;
  for (const pref of prefs) applied += await applyPref(pref, byCode5);
  // 全県実行時のみ全国合計行と突合（±0.1%）。表構成変更による取り違えを検知する。
  if (prefs.length === 47 && typeof national === "number") {
    const diff = Math.abs(applied - national) / national;
    console.log(`全国突合: 適用合計 ${applied.toLocaleString()} / 全国行 ${national.toLocaleString()}（乖離 ${(diff * 100).toFixed(3)}%）`);
    if (diff > 0.001) throw new Error("適用した市区町村の総人口が全国合計行と一致しません（様式変更?）");
  }
  console.log("data files 保存完了");
}

main().catch((e) => { console.error(e); process.exit(1); });
