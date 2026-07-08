// 出入国在留管理庁「在留外国人統計」（e-Stat 提供）の市区町村別 Excel から、
// 市区町村別の在留外国人「総数」を抽出し、data/{pref}.json の foreignResidents に反映する。
//
// 使用表: 在留外国人統計テーブルデータ（国籍・地域別 在留資格別 市区町村別）= 表番号 YY-MM-t2。
//   このファイルは Power Pivot（OLAP データモデル）形式で、ワークシート(PVTシート)に
//   現れるのは「市区町村ごとの総数」だけ（A:市区町村コード / B:都道府県 / C:市区町村 /
//   D:合計 在留外国人数）。国籍内訳は xl/model/item.data のバイナリ内にのみあり、SheetJS
//   では読めないため本スクリプトは総数のみ扱う（人口比は実行時に人口と突き合わせて算出）。
//
// 事前: e-Stat「在留外国人統計 月次」の最新期から t2（市区町村別）の Excel を取得。
//   例（2024年12月時点 / statInfId は期ごとに変わる。docs/data-update.md 参照）:
//   curl -L -A "Mozilla/5.0" -o /tmp/zairyu_muni.xlsx \
//     "https://www.e-stat.go.jp/stat-search/file-download?statInfId=000040292373&fileKind=0"
// 実行: node scripts/fetch-foreign-residents.mjs --all
//   （全国1ファイルから全県へ反映。--pref=saitama で単県のみも可）

import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import * as fs from "node:fs";
import XLSX from "xlsx";
import { resolvePrefs, PREFS } from "./_lib/prefs.mjs";

// xlsx の ESM ビルド（xlsx.mjs）は fs を自動注入しないため、readFile 前に明示的に渡す。
XLSX.set_fs?.(fs);
import { loadMuni, saveMuni } from "./_lib/data.mjs";
import { version } from "./_lib/versions.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const prefs = resolvePrefs(process.argv.slice(2));

const XLSX_PATH =
  process.env.FOREIGN_XLSX ||
  process.argv.find((a) => a.endsWith(".xlsx")) ||
  "/tmp/zairyu_muni.xlsx";
if (!existsSync(XLSX_PATH)) {
  console.error(`Excel not found: ${XLSX_PATH}（FOREIGN_XLSX で指定可）`);
  process.exit(1);
}

// 基準時点と出典（表示・鮮度判定に使用）。期を更新したら asOf を合わせる。
// 既定は scripts/_lib/versions.mjs の単一ソース（env で上書き可）。
const ASOF = version("FOREIGN_ASOF");
const META = {
  unit: "人",
  source: "出入国在留管理庁 在留外国人統計",
  asOf: ASOF,
  isEstimated: false,
};
// 北方領土の村（歯舞群島・色丹島・国後島・択捉島）は調査対象外（注4）。
// 災害・地価と同じ「対象外（理由）」センチネルで欠損を明示する。
const NORTHERN_TERRITORIES = new Set([
  "01695", "01696", "01697", "01698", "01699", "01700",
]);

// Excel(PVTシート) → Map<市区町村コード, 総数>。ヘッダ行（"市区町村コード"始まり）を
// 検出し、以降の5桁コード行のみ採用（"99999 未定・不詳" や "総計" 行は5桁でない／除外）。
// 合計列は期によって位置が変わる（24-12 は4列目、25-06 で「政令指定都市」列が挿入され
// 5列目に移動）ため、ヘッダ行の「合計」で始まる列を動的に解決する。
function parseExcel(xlsxPath) {
  const wb = XLSX.readFile(xlsxPath);
  const ws = wb.Sheets["PVT"];
  if (!ws) throw new Error('シート "PVT" が見つかりません');
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, raw: true });
  const hi = rows.findIndex((r) => r[0] === "市区町村コード");
  if (hi < 0) throw new Error("ヘッダ行（市区町村コード）が見つかりません");
  const ti = rows[hi].findIndex((c) => typeof c === "string" && c.startsWith("合計"));
  if (ti < 0) throw new Error("合計列（合計 / 在留外国人数）が見つかりません");
  const byCode = new Map();
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i];
    const code = r[0] == null ? "" : String(r[0]).trim();
    const total = r[ti];
    if (!/^\d{5}$/.test(code)) continue; // 5桁コードのみ（集計擬似行を除外）
    if (typeof total !== "number") continue;
    byCode.set(code, total);
  }
  return byCode;
}

// 全 pref を跨ぐ「政令市 親コード → 子区コード[]」マップ（区合算で親の総数を作る用）。
function parentToWardsAll() {
  const map = new Map();
  for (const slug of Object.keys(PREFS)) {
    const p2w = PREFS[slug].parentToWards ?? {};
    for (const [parent, children] of Object.entries(p2w)) map.set(parent, children);
  }
  return map;
}

async function applyPref(pref, excel, p2w) {
  const { muni, wards, paths } = await loadMuni(ROOT, pref);
  let withData = 0, parents = 0, excluded = 0, zero = 0;

  const setFrom = (m) => {
    if (NORTHERN_TERRITORIES.has(m.code)) {
      m.foreignResidents = { value: 0, ...META, source: "対象外（北方領土）" };
      excluded++;
      return;
    }
    const v = excel.get(m.code);
    if (v != null) {
      m.foreignResidents = { value: v, ...META };
      withData++;
    } else {
      // Excel に出てこない＝当該期の在留外国人 0（pivot は 0 の自治体を載せない）。
      m.foreignResidents = { value: 0, ...META };
      zero++;
    }
  };

  // 市区町村（政令市の親を除く）と 行政区にまず直接反映する。
  for (const m of muni) {
    if (p2w.has(m.code)) continue; // 親は後で区合算
    setFrom(m);
  }
  for (const w of wards) setFrom(w);

  // 政令市の親 = 子区の総数を合算（Excel は区別のみ収録のため）。
  for (const m of muni) {
    const children = p2w.get(m.code);
    if (!children) continue;
    let sum = 0;
    for (const cc of children) {
      const v = excel.get(cc);
      if (typeof v === "number") sum += v;
    }
    m.foreignResidents = { value: sum, ...META };
    parents++;
  }

  await saveMuni(paths, muni, wards);
  console.log(
    `${pref.slug}: 実数 ${withData} / 政令市親(区合算) ${parents} / 0人 ${zero} / 対象外 ${excluded}`,
  );
}

async function main() {
  const excel = parseExcel(XLSX_PATH);
  console.log(`Excel 市区町村コード: ${excel.size} 件 / 全国総数 ${[...excel.values()].reduce((a, b) => a + b, 0).toLocaleString()} 人`);
  // 「Excel 不掲載 = 0人」で全県を上書きするため、パース失敗（レイアウト変更等）で
  // 全自治体 0 人になる事故を防ぐ。市区町村別は例年 ~1,700-1,900 件掲載される。
  if (excel.size < 1000) {
    throw new Error(`パース件数が異常に少ない（${excel.size} 件）。Excel のレイアウト変更を確認してください`);
  }
  const p2w = parentToWardsAll();
  for (const pref of prefs) await applyPref(pref, excel, p2w);
  console.log("data files 保存完了");
}

main().catch((e) => { console.error(e); process.exit(1); });
