// 令和5年住宅・土地統計調査「住宅及び世帯総数 居住世帯の有無(8区分)別住宅数
// －全国、都道府県、市区町村」(statsDataId 0004021421) から市区町村別の
// 住宅総数(cat01=0)と空き家数(cat01=22)を取得し、空き家率(%)を data/*.json の
// vacancy に反映する。総務省公表の「空き家率」（2023年 全国13.8%）と同じ定義。
//
// 家賃(fetch-rent.mjs)と同じ調査のため対象制約も同じ:
// 市区町村集計は人口1.5万人未満の町村を含まない → 表に無い自治体は rate=-1 の
// 対象外センチネルを書く（推計で埋めない。docs/data-update.md の honesty 方針）。
// 出典は5年周期（次回2028年調査）。
//
// 実行: node --env-file=.env.local scripts/fetch-vacancy.mjs --all

import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePrefs } from "./_lib/prefs.mjs";
import { loadAllMuni, saveMuni } from "./_lib/data.mjs";
import { requireEstatAppId, fetchStatsValues } from "./_lib/estat.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const APP_ID = requireEstatAppId();

const STATS_DATA_ID = "0004021421";
const SOURCE = "住宅・土地統計調査（居住世帯の有無別住宅数）";
const SOURCE_EXCLUDED = "データなし（住宅統計の集計対象外）";
const AS_OF = "2023";
const CAT_TOTAL = "0";  // 居住世帯の有無: 総数（住宅総数）
const CAT_VACANT = "22"; // 居住世帯の有無: 空き家

async function fetchCounts(codes) {
  // area -> { total, vacant }
  const byArea = new Map();
  const rows = await fetchStatsValues(APP_ID, STATS_DATA_ID, codes, {
    cdCat01: `${CAT_TOTAL},${CAT_VACANT}`,
  });
  for (const v of rows) {
    const area = v["@area"];
    const n = parseInt(v["$"], 10);
    if (Number.isNaN(n)) continue;
    if (!byArea.has(area)) byArea.set(area, { total: 0, vacant: 0 });
    if (v["@cat01"] === CAT_TOTAL) byArea.get(area).total = n;
    else if (v["@cat01"] === CAT_VACANT) byArea.get(area).vacant = n;
  }
  return byArea;
}

async function main() {
  const prefs = resolvePrefs(process.argv.slice(2));
  const { entries, byCode, codes } = await loadAllMuni(ROOT, prefs);
  console.log(`対象 ${prefs.length}県 / ${codes.length}自治体 の空き家数を一括取得...`);
  const byArea = await fetchCounts(codes);
  console.log(`データ取得: ${byArea.size}自治体`);

  let filled = 0, excluded = 0, natVacant = 0, natTotal = 0;
  for (const [code, m] of byCode) {
    const c = byArea.get(code);
    if (c && c.total > 0) {
      m.vacancy = {
        rate: Math.round((c.vacant / c.total) * 1000) / 10, // 小数1桁
        vacant: c.vacant,
        total: c.total,
        source: SOURCE,
        asOf: AS_OF,
      };
      filled++;
      // 全国合計の突合用（区は親市と二重になるため市区町村レベルのみ加算）
      if ((m.level ?? "muni") === "muni") { natVacant += c.vacant; natTotal += c.total; }
    } else {
      // 表に無い＝人口1.5万人未満の町村（集計対象外）。推計で埋めない。
      m.vacancy = { rate: -1, vacant: 0, total: 0, source: SOURCE_EXCLUDED, asOf: "-" };
      excluded++;
    }
  }
  console.log(`実数 ${filled} / 対象外 ${excluded}`);
  console.log(
    `市区町村合計: 空き家 ${natVacant.toLocaleString()} / 住宅総数 ${natTotal.toLocaleString()}` +
      `（率 ${((natVacant / natTotal) * 100).toFixed(1)}% — 全国値13.8%は対象外町村を含むため一致はしない。近いことを確認）`,
  );

  for (const { paths, muni, wards } of entries) await saveMuni(paths, muni, wards);
  console.log("data files 保存完了");
}

main().catch((e) => { console.error(e); process.exit(1); });
