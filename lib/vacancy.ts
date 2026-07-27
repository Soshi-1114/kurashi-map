// 空き家率（住宅・土地統計調査）の対象判定と表示ヘルパー。
// 家賃（lib/rentColor.ts hasRent）と同じ調査のため対象制約も同じ:
// 人口1.5万人未満の町村は市区町村集計の対象外 → rate=-1 センチネル + source に対象外文言。
// UI は「対象外」を表示し、0% は「空き家が無い」という実データとして区別する。

import type { Municipality } from "./types";

export type Vacancy = NonNullable<Municipality["vacancy"]>;

/** 空き家率が有効値（実データ）かどうか。undefined / rate<0 は対象外・未収録。 */
export function hasVacancy(v: Municipality["vacancy"]): v is Vacancy {
  return v != null && v.rate >= 0 && v.total > 0;
}

/** 表示用: "13.8%"。 */
export function vacancyRateText(v: Vacancy): string {
  return `${v.rate.toFixed(1)}%`;
}
