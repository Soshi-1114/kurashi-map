// 令和5年住宅・土地統計調査 (statsDataId 0004021470) の家賃区分別借家数を
// 取得し、bin midpoints の加重平均で平均家賃を計算、data/{pref}.json に反映。
// 併せて、件数のある区分の下限〜上限から「目安レンジ」(rentRange) も算出する
// （区分境界は e-Stat CLASS_INF(cat01) で実データを確認済み。cat01 "01"=0円 と
// "99"=不詳 は平均計算と同じく対象外。最上位区分「200,000円以上」は上限を
// 定義できないため rentRange.max=null とし、UI 側で「以上」表記にする）。
//
// 実行: node --env-file=.env.local scripts/fetch-rent.mjs --pref=saitama

import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePrefs } from "./_lib/prefs.mjs";
import { loadAllMuni, saveMuni } from "./_lib/data.mjs";
import { requireEstatAppId, fetchStatsValues } from "./_lib/estat.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const APP_ID = requireEstatAppId();

const STATS_DATA_ID = "0004021470";
// cat01 区分（家賃階級。e-Stat CLASS_INF で実データ確認済み）。lo/hi は加重平均・
// レンジ算出の両方が使う下限・上限（上限 null は最上位区分＝上限なし）、mid は
// weightedMean() 用の階級中点。低い順の配列にする: オブジェクトの Object.keys() だと
// "10" が正準な整数インデックスキーとして先頭に並び替えられてしまい
// （"02" 等は先頭ゼロで整数キー扱いされない）、rentRange() の正しさが崩れるため。
const RENT_BINS = [
  { cat: "02", lo: 0, hi: 10000, mid: 5000 },
  { cat: "03", lo: 10000, hi: 20000, mid: 15000 },
  { cat: "04", lo: 20000, hi: 40000, mid: 30000 },
  { cat: "05", lo: 40000, hi: 60000, mid: 50000 },
  { cat: "06", lo: 60000, hi: 80000, mid: 70000 },
  { cat: "07", lo: 80000, hi: 100000, mid: 90000 },
  { cat: "08", lo: 100000, hi: 150000, mid: 125000 },
  { cat: "09", lo: 150000, hi: 200000, mid: 175000 },
  { cat: "10", lo: 200000, hi: null, mid: 220000 },
];

// area -> (家賃区分 cat01 -> 借家数) の分布 Map。加重平均の材料。
async function fetchDistribution(codes) {
  const byArea = new Map();
  const rows = await fetchStatsValues(APP_ID, STATS_DATA_ID, codes, { cdCat02: "0" });
  for (const v of rows) {
    const area = v["@area"]; const cat = v["@cat01"];
    const n = parseInt(v["$"], 10);
    if (Number.isNaN(n)) continue;
    if (!byArea.has(area)) byArea.set(area, new Map());
    byArea.get(area).set(cat, n);
  }
  return byArea;
}

function weightedMean(distribution) {
  let weighted = 0, total = 0;
  for (const { cat, mid } of RENT_BINS) {
    const count = distribution.get(cat);
    if (!count) continue;
    weighted += mid * count;
    total += count;
  }
  return total === 0 ? null : Math.round(weighted / total);
}

// 件数が1件以上ある最小区分の下限 〜 最大区分の上限を「目安レンジ」として返す。
// 該当区分が1つもなければ null（weightedMean が null になるケースと同じ）。
function rentRange(distribution) {
  let min = null;
  let max;
  let hasAny = false;
  for (const { cat, lo, hi } of RENT_BINS) {
    const count = distribution.get(cat);
    if (!count) continue;
    if (min == null) min = lo;
    max = hi;
    hasAny = true;
  }
  return hasAny ? { min, max } : null;
}

async function main() {
  // 対象 pref 群の全コードを1リクエスト群でまとめ取得し、各 muni に加重平均家賃を分配。
  const prefs = resolvePrefs(process.argv.slice(2));
  const { entries, byCode, codes } = await loadAllMuni(ROOT, prefs);
  console.log(`対象 ${prefs.length}県 / ${codes.length}自治体 の家賃分布を一括取得...`);
  const byArea = await fetchDistribution(codes);
  console.log(`データ取得: ${byArea.size}自治体`);

  const missing = [];
  for (const [code, m] of byCode) {
    const dist = byArea.get(code);
    const mean = dist ? weightedMean(dist) : null;
    if (mean == null) { missing.push(`${code} ${m.name}`); continue; }
    m.rent = {
      value: mean,
      unit: "円/月",
      source: "住宅・土地統計調査（加重平均）",
      asOf: "2023",
      isEstimated: false,
    };
    const range = rentRange(dist);
    if (range) m.rentRange = range;
    else delete m.rentRange;
  }
  if (missing.length) console.warn(`Missing ${missing.length}:`, missing.join(", "));

  for (const { paths, muni, wards } of entries) await saveMuni(paths, muni, wards);
}

main().catch((e) => { console.error(e); process.exit(1); });
