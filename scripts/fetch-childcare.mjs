// こども家庭庁「保育所等関連状況取りまとめ」別添「（参考）定員・申込者の状況」Excel から、
// 市区町村別の保育所等の定員・利用児童数・隠れ待機（育休中+特定園のみ希望+求職休止）を
// 抽出し、data/{pref}.json の childcare に反映する。
// 待機児童（fetch-waitlist.mjs）と同一の年次公表物の別ワークブック（R8 は _02.xlsx）で、
// 基準時点は CFA_ASOF を共用する。市区町村別の別添は令和6年分から存在。
//
// シート構成（R8 で実ファイル確認済み。行=市区町村、県計・全国計の行はない）:
// - 「定員の状況」: 列2=都道府県, 3=市区町村, 4..10=合計の施設類型7区分,
//   11..17=0歳児, 18..24=1,2歳児, 25..31=3歳以上児（年齢別の合計=総計と検算一致）
// - 「申込者の状況」: 列2=都道府県, 3=市区町村, 年齢ブロックごとに12列
//   （申込者数, 利用7類型, 育休中, 特定園のみ, 求職休止, 待機児童）。
//   合計=4起点, 0歳児=16起点, 1歳児=28起点, 2歳児=40起点, 3歳以上児=52起点
//
// 政令市は市単位集計のため、区には市全体の値を source「（○○市全体の集計）」付きで持たせる
// （lib/childcare.ts isChildcareCityAggregate が判定）。
//
// 事前: curl -sL -o /tmp/cfa_childcare.xlsx "<CFA_CAPACITY_XLSX_URL>"
// 実行: node scripts/fetch-childcare.mjs --pref=saitama / --all

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

const CFA_ASOF = version("CFA_ASOF");
const SOURCE = "こども家庭庁 保育所等関連状況取りまとめ（定員・申込者の状況）";

const prefs = resolvePrefs(process.argv.slice(2));

const XLSX_PATH = process.env.CHILDCARE_XLSX ||
  process.argv.find((a) => a.endsWith(".xlsx")) ||
  "/tmp/cfa_childcare.xlsx";
if (!existsSync(XLSX_PATH)) {
  console.error(`Excel not found: ${XLSX_PATH}`);
  process.exit(1);
}

// 範囲 [from, to] の数値セルを合計（空欄は 0 扱い。文字列等は数値でないので無視）。
function sumCols(row, from, to) {
  let total = 0;
  for (let i = from; i <= to; i++) if (typeof row[i] === "number") total += row[i];
  return total;
}

// 「都道府県名|市区町村名」→ 抽出値。県計行が無いことは実ファイルで確認済みだが、
// 念のため県名列が正規の都道府県名である行だけを拾う（fetch-waitlist.mjs と同じ方針）。
const PREF_NAMES = new Set([
  "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
  "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
  "新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県","静岡県","愛知県",
  "三重県","滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県",
  "鳥取県","島根県","岡山県","広島県","山口県","徳島県","香川県","愛媛県","高知県",
  "福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県",
]);

function keyOf(row) {
  const pref = row[2];
  const muni = row[3];
  if (typeof pref !== "string" || !PREF_NAMES.has(pref.trim())) return null;
  if (typeof muni !== "string" || muni.trim() === "") return null;
  return `${pref.trim()}|${muni.trim()}`;
}

function extractCapacity(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, raw: true });
  const out = new Map();
  for (const r of rows) {
    const key = keyOf(r);
    if (!key || typeof r[4] !== "number") continue;
    out.set(key, {
      capacity: sumCols(r, 4, 10),
      capacityAge0: sumCols(r, 11, 17),
      capacityAge12: sumCols(r, 18, 24),
    });
  }
  return out;
}

function extractApplicants(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, raw: true });
  const out = new Map();
  for (const r of rows) {
    const key = keyOf(r);
    if (!key || typeof r[4] !== "number") continue;
    out.set(key, {
      enrolled: sumCols(r, 5, 11),
      // 隠れ待機 = 育児休業中(12) + 特定園のみ希望(13) + 求職活動休止(14)
      hiddenWaitlist: sumCols(r, 12, 14),
      // 1,2歳児の利用 = 1歳児ブロック(29..35) + 2歳児ブロック(41..47)
      enrolledAge0: sumCols(r, 17, 23),
      enrolledAge12: sumCols(r, 29, 35) + sumCols(r, 41, 47),
    });
  }
  return out;
}

async function applyPref(pref, capacity, applicants) {
  const { muni, wards, paths } = await loadMuni(ROOT, pref);

  let hit = 0, miss = 0;
  for (const m of muni) {
    const key = `${pref.nameJa}|${m.name}`;
    const cap = capacity.get(key);
    const app = applicants.get(key);
    if (!cap || !app) { miss++; continue; }
    m.childcare = { ...cap, ...app, source: SOURCE, asOf: CFA_ASOF };
    hit++;
  }

  // 政令市の区: 市単位集計のため市全体の値を展開（source で市全体と明示）。
  for (const [parent, children] of Object.entries(pref.parentToWards ?? {})) {
    const p = muni.find((m) => m.code === parent);
    if (!p?.childcare) continue;
    for (const cc of children) {
      const w = wards.find((x) => x.code === cc);
      if (w) w.childcare = { ...p.childcare, source: `${SOURCE}（${p.name}全体の集計）` };
    }
  }

  await saveMuni(paths, muni, wards);
  console.log(`${pref.slug}: childcare ${hit} / 未収録 ${miss}`);
}

async function main() {
  const wb = XLSX.readFile(XLSX_PATH);
  const capWs = wb.Sheets["定員の状況"];
  const appWs = wb.Sheets["申込者の状況"];
  if (!capWs || !appWs) {
    console.error(`シートが見つかりません（期待: 定員の状況 / 申込者の状況。実際: ${wb.SheetNames.join(", ")}）`);
    process.exit(1);
  }
  const capacity = extractCapacity(capWs);
  const applicants = extractApplicants(appWs);
  console.log(`定員の状況: ${capacity.size} entries / 申込者の状況: ${applicants.size} entries`);
  for (const pref of prefs) await applyPref(pref, capacity, applicants);
  console.log("data files 保存完了");
}

main().catch((e) => { console.error(e); process.exit(1); });
