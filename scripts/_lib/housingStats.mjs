// 住宅・土地統計調査「居住世帯の有無(8区分)別住宅数 －全国、都道府県、市区町村」から
// 住宅総数と空き家数を取り出す共通処理。
//
// 同じ統計表を市区町村版（fetch-vacancy.mjs）と都道府県版（fetch-vacancy-pref.mjs）の
// 両方が引くため、表ID・カテゴリコード・基準年をここに集約する。2028年調査へ上げるときに
// 2ファイルを直す必要をなくし、片方だけ直して年度が食い違う事故を防ぐ。

import { fetchStatsValues } from "./estat.mjs";

/** 令和5年住宅・土地統計調査の統計表ID（全国・都道府県・市区町村を含む1表）。 */
export const HOUSING_STATS_DATA_ID = "0004021421";
/** データの基準年（表IDと必ず同期させる）。 */
export const HOUSING_AS_OF = "2023";

const CAT_TOTAL = "0";   // 居住世帯の有無: 総数（住宅総数）
const CAT_VACANT = "22"; // 居住世帯の有無: 空き家

/**
 * 地域コード配列に対する { total, vacant } を取得する。
 * 表に存在しない地域は Map に現れない（0 で埋めない ＝ 呼び出し側が対象外と判断する）。
 */
export async function fetchHousingCounts(appId, codes) {
  const rows = await fetchStatsValues(appId, HOUSING_STATS_DATA_ID, codes, {
    cdCat01: `${CAT_TOTAL},${CAT_VACANT}`,
  });
  const byArea = new Map();
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
