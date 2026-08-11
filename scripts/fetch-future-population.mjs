// 国立社会保障・人口問題研究所（IPSS）「日本の地域別将来推計人口（令和5(2023)年推計）」
// の結果表 Excel から、市区町村別の将来推計人口（総数 2025-2050・2050年の年齢3区分）を
// data/{pref}.json / {pref}_wards.json の futurePopulation に反映する。
//
// 公的推計の公表値をそのまま収録し、自前の推計・按分は一切しない（honesty 方針）。
// 対象外（浜通り13市町村・北方領土6村・浜松市中央区/浜名区）は「対象外（理由）」の
// source センチネルで明示する。判定は scripts/_lib/ipss.mjs に集約。
//
// 事前: 結果表 Excel 4本を1つのディレクトリに取得しておく（約5年周期の手動更新のみ。
//   URL は scripts/_lib/versions.mjs の IPSS_BASE_URL。docs/data-update.md §将来推計人口）:
//   mkdir -p /tmp/ipss && cd /tmp/ipss
//   for f in kekkahyo1 kekkahyo2_1 kekkahyo2_2 kekkahyo2_3; do
//     curl -sL -A "Mozilla/5.0" -O "https://www.ipss.go.jp/pp-shicyoson/j/shicyoson23/2gaiyo_hyo/$f.xlsx"
//   done
// 実行: node scripts/fetch-future-population.mjs --all
//   （--pref=saitama で単県のみ。IPSS_XLSX_DIR で取得先ディレクトリを上書き可）

import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import * as fs from "node:fs";
import XLSX from "xlsx";
import { resolvePrefs } from "./_lib/prefs.mjs";
import { loadMuni, saveMuni } from "./_lib/data.mjs";
import { version } from "./_lib/versions.mjs";
import {
  IPSS_YEARS,
  parseIpssSheet,
  exclusionReason,
  IPSS_CODE_REMAP,
} from "./_lib/ipss.mjs";

// xlsx の ESM ビルドは fs を自動注入しないため明示的に渡す（fetch-foreign-residents と同じ）。
XLSX.set_fs?.(fs);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const XLSX_DIR = process.env.IPSS_XLSX_DIR || "/tmp/ipss";
const ASOF = version("IPSS_ASOF");
const SOURCE = "国立社会保障・人口問題研究所 日本の地域別将来推計人口（令和5年推計）";

function readSheet(name) {
  const fp = path.join(XLSX_DIR, name);
  if (!existsSync(fp)) {
    console.error(`Excel が見つかりません: ${fp}`);
    console.error("ヘッダーコメントの curl でダウンロードしてから再実行してください（IPSS_XLSX_DIR で場所を上書き可）。");
    process.exit(1);
  }
  const wb = XLSX.readFile(fp);
  const ws = wb.Sheets[wb.SheetNames[0]];
  return parseIpssSheet(XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, raw: true }));
}

const prefs = resolvePrefs(process.argv.slice(2));

// 結果表 4本。2-4（75歳以上）は現状未使用のため取得対象に含めない。
const totalSheet = readSheet("kekkahyo1.xlsx"); // 総人口
const youngSheet = readSheet("kekkahyo2_1.xlsx"); // 0-14歳
const workingSheet = readSheet("kekkahyo2_2.xlsx"); // 15-64歳
const elderlySheet = readSheet("kekkahyo2_3.xlsx"); // 65歳以上
console.log(
  `IPSS 結果表を読込: 総人口 ${totalSheet.size} 自治体 / 年齢3区分 ${youngSheet.size}・${workingSheet.size}・${elderlySheet.size}`,
);

const Y2050 = IPSS_YEARS.indexOf("2050");

let withData = 0;
let remapped = 0;
let excluded = 0;
const unmatched = [];

for (const pref of prefs) {
  const { muni, wards, all, paths } = await loadMuni(ROOT, pref);
  for (const m of all) {
    const reason = exclusionReason(m.code);
    if (reason) {
      m.futurePopulation = {
        base2020: 0,
        total: {},
        young2050: 0,
        working2050: 0,
        elderly2050: 0,
        source: reason,
        asOf: ASOF,
      };
      excluded++;
      continue;
    }
    // 浜松市天竜区: 2024年再編で区域変更なくコードのみ変わったため旧コードで引く。
    const ipssCode = IPSS_CODE_REMAP.get(m.code) ?? m.code;
    const total = totalSheet.get(ipssCode);
    const young = youngSheet.get(ipssCode);
    const working = workingSheet.get(ipssCode);
    const elderly = elderlySheet.get(ipssCode);
    if (!total || !young || !working || !elderly) {
      unmatched.push(`${m.code} ${m.displayName ?? m.name}（${pref.nameJa}）`);
      continue;
    }
    m.futurePopulation = {
      base2020: total[0],
      // 2020 は base2020 として持つので、total には 2025 以降を入れる。
      total: Object.fromEntries(IPSS_YEARS.slice(1).map((y, i) => [y, total[i + 1]])),
      young2050: young[Y2050],
      working2050: working[Y2050],
      elderly2050: elderly[Y2050],
      source: SOURCE,
      asOf: ASOF,
    };
    withData++;
    if (ipssCode !== m.code) remapped++;
  }
  await saveMuni(paths, muni, wards);
  console.log(`${pref.nameJa}: ${all.length} 自治体を更新`);
}

console.log(
  `完了: 収録 ${withData}（うちコード読み替え ${remapped}）/ 対象外 ${excluded} / 不一致 ${unmatched.length}`,
);
if (unmatched.length > 0) {
  console.error("IPSS 側に見つからなかった自治体（対象外リストの見直しが必要）:");
  for (const u of unmatched) console.error("  " + u);
  process.exit(1);
}
