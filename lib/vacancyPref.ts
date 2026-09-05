// 都道府県別の空き家率（住宅・土地統計調査の *都道府県表* の公表値）。
//
// 市区町村別の空き家率（lib/vacancy.ts）とは別系統であることが重要。同じ調査でも
// 市区町村別集計は人口1.5万人未満の町村を含まず、それらは空き家率の高い過疎地に
// 偏るため、市区町村を合算すると系統的に低く出る。実際、合算では徳島 21.33% /
// 和歌山 21.25%（公表）が 20.4% / 20.7% となり **1位が逆転した**。
// 都道府県の値が要るときは必ずこちらを使い、市区町村から合算しないこと。
//
// データは scripts/fetch-vacancy-pref.mjs が e-Stat から取得して
// data/vacancy-pref.json に書く（全国合計が公表の13.8%に一致することを確認済み）。

import vacancyPrefJson from "../data/vacancy-pref.json";

export type PrefVacancy = {
  /** 空き家率（%・小数2桁） */
  rate: number;
  /** 空き家数（戸） */
  vacant: number;
  /** 住宅総数（戸） */
  total: number;
};

type VacancyPrefFile = {
  source: string;
  asOf: string;
  prefs: Record<string, PrefVacancy>;
};

const file = vacancyPrefJson as VacancyPrefFile;

export const PREF_VACANCY_SOURCE = file.source;
export const PREF_VACANCY_ASOF = file.asOf;

/** 都道府県スラッグ → 空き家率（%）。未収録は null（0 で埋めない）。 */
export function prefVacancyRate(prefSlug: string): number | null {
  return file.prefs[prefSlug]?.rate ?? null;
}
