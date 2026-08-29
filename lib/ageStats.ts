// 年齢構成（住民基本台帳・毎年1月1日時点）のアクセサ。UI・ランキングは必ずここを
// 経由する（hasRent / hasVacancy 等と同じ「対象判定をヘルパーに集約する」方針）。
//
// 高齢化率・年少人口比は保存せず、ここで生値から算出する（派生値は保存しない方針）。
// 分母は同一表の住基台帳総人口（total）で、調査基準の異なる現在の population
// （2025年国勢調査）とは混ぜない。
//
// データなしの表現は null 戻し。比率0%は理論上実データになり得るため、負のセンチネル
// 数値は使わない（futurePopulation と同じ）。

import type { Municipality } from "./types";

type AgeStats = NonNullable<Municipality["ageStats"]>;

/** freshnessLabel 用のサフィックス（例: 「2026年1月住民基本台帳」）。 */
export const AGE_FRESHNESS_SUFFIX = "住民基本台帳";

/**
 * 年齢構成データがあるか。フィールド未収録（ETL 未実行）と、住民登録のない
 * 北方領土6村（total=0 センチネル）の両方を弾く。
 */
export function hasAgeData(a: Municipality["ageStats"]): a is AgeStats {
  return a != null && a.total > 0;
}

/** 高齢化率（65歳以上人口 ÷ 住基総人口、%）。データなしは null。 */
export function elderlyRatioPct(a: Municipality["ageStats"]): number | null {
  if (!hasAgeData(a)) return null;
  return (a.elderly / a.total) * 100;
}

/** 年少人口比（0〜14歳人口 ÷ 住基総人口、%）。データなしは null。 */
export function youngRatioPct(a: Municipality["ageStats"]): number | null {
  if (!hasAgeData(a)) return null;
  return (a.young / a.total) * 100;
}

/** 表示用: "36.2%"（小数1桁）。データなしは "—"。 */
export function elderlyRatioText(a: Municipality["ageStats"]): string {
  const v = elderlyRatioPct(a);
  return v == null ? "—" : `${v.toFixed(1)}%`;
}

/** 表示用: "11.4%"（小数1桁）。データなしは "—"。 */
export function youngRatioText(a: Municipality["ageStats"]): string {
  const v = youngRatioPct(a);
  return v == null ? "—" : `${v.toFixed(1)}%`;
}
