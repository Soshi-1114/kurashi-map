// 将来推計人口（IPSS 令和5(2023)年推計）のアクセサ。UI・ランキングは必ずここを経由する
// （hasRent / hasVacancy 等と同じ「対象判定をヘルパーに集約する」方針）。
//
// 派生値（増減率・高齢化率）は保存せず、ここで生値から算出する（人口密度・外国人比率と
// 同じ「派生値は保存しない」方針）。分母は必ず IPSS 内部の2020年基準人口（base2020）で、
// 調査基準の異なる現在の population（2025年国勢調査）とは混ぜない。

import type { Municipality } from "./types";

type FuturePopulation = NonNullable<Municipality["futurePopulation"]>;

/** 算出不能（データなし・対象外）を表すセンチネル。UI 側は has* で先に判定すること。 */
export const FUTURE_NODATA = -1;

/**
 * 市区町村別の将来推計があるか。フィールド未収録（ETL 未実行）と、
 * 「対象外」センチネル（浜通り13市町村・北方領土6村・浜松市中央区/浜名区）の両方を弾く。
 */
export function hasFuturePopulation(fp: Municipality["futurePopulation"]): fp is FuturePopulation {
  return fp != null && !String(fp.source ?? "").includes("対象外") && fp.base2020 > 0;
}

/** 指定年の推計総人口。データなしは null。 */
export function futureTotal(fp: Municipality["futurePopulation"], year: string): number | null {
  if (!hasFuturePopulation(fp)) return null;
  const v = fp.total[year];
  return typeof v === "number" ? v : null;
}

/**
 * 2020年基準人口 → 2050年推計人口の増減率（%）。例: -32.4 = 32.4%減。
 * データなしは FUTURE_NODATA。
 */
export function futureChangeRate2050(fp: Municipality["futurePopulation"]): number {
  const t2050 = futureTotal(fp, "2050");
  if (t2050 == null || !hasFuturePopulation(fp)) return FUTURE_NODATA;
  return ((t2050 - fp.base2020) / fp.base2020) * 100;
}

/** 2050年の高齢化率（65歳以上 ÷ 総人口、%）。データなしは FUTURE_NODATA。 */
export function elderlyRatio2050(fp: Municipality["futurePopulation"]): number {
  const t2050 = futureTotal(fp, "2050");
  if (t2050 == null || t2050 <= 0 || !hasFuturePopulation(fp)) return FUTURE_NODATA;
  return (fp.elderly2050 / t2050) * 100;
}
