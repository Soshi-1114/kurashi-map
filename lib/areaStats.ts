// 比較用の集計レイヤー（家賃・地価・人口増減率・空き家率・人口密度の「全国平均」「都道府県平均」）。
// foreignStats と同じ方針: 平均はすべて実データの単純平均で算出し、推計・補完はしない。
// 算出対象＝市区町村レベル（政令市の行政区を除外。1自治体1エントリ）かつ各指標の有効値のみ。
//
// 平均は「自治体ごとの家賃平均/地価の単純平均」（自治体を1票とする算術平均）。人口加重では
// ないため、比較バーの参考線として中立に提示する。

import type { Municipality } from "./types";
import { hasRent } from "./rentColor";
import { hasLandPrice } from "./landPrice";
import { hasVacancy } from "./vacancy";
import { populationDensity } from "./populationDensity";

export type MetricAvg = {
  /** 全国平均（有効値を持つ自治体の単純平均）。対象0件なら null。 */
  national: number | null;
  /** 都道府県平均（pref スラッグ → 平均）。 */
  byPref: Map<string, number>;
};

export type AreaStats = {
  rent: MetricAvg;
  landPrice: MetricAvg;
  /** 人口増減率（%）の平均（小数1桁）。 */
  populationChangeRate: MetricAvg;
  /** 空き家率（%）の平均（小数1桁）。 */
  vacancyRate: MetricAvg;
  /** 人口密度（人/km²）の平均（整数）。 */
  density: MetricAvg;
};

function mean(values: number[], decimals = 0): number | null {
  if (values.length === 0) return null;
  const factor = 10 ** decimals;
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * factor) / factor;
}

function buildMetricAvg(
  munis: Municipality[],
  pick: (m: Municipality) => number | null,
  decimals = 0,
): MetricAvg {
  const all: number[] = [];
  const byPrefValues = new Map<string, number[]>();
  for (const m of munis) {
    const v = pick(m);
    if (v == null) continue;
    all.push(v);
    const arr = byPrefValues.get(m.pref);
    if (arr) arr.push(v);
    else byPrefValues.set(m.pref, [v]);
  }
  const byPref = new Map<string, number>();
  for (const [pref, vals] of byPrefValues) {
    const avg = mean(vals, decimals);
    if (avg !== null) byPref.set(pref, avg);
  }
  return { national: mean(all, decimals), byPref };
}

/** 全自治体から各指標の全国/県平均をまとめて構築する。 */
export function buildAreaStats(all: Municipality[]): AreaStats {
  const munis = all.filter((m) => (m.level ?? "muni") !== "ward");
  return {
    rent: buildMetricAvg(munis, (m) => (hasRent(m.rent.value) ? m.rent.value : null)),
    landPrice: buildMetricAvg(munis, (m) => (hasLandPrice(m.landPrice.value) ? m.landPrice.value : null)),
    populationChangeRate: buildMetricAvg(
      munis,
      (m) => (typeof m.populationChangeRate === "number" && m.population > 0 ? m.populationChangeRate : null),
      1,
    ),
    vacancyRate: buildMetricAvg(munis, (m) => (hasVacancy(m.vacancy) ? m.vacancy.rate : null), 1),
    density: buildMetricAvg(munis, (m) => populationDensity(m)),
  };
}

// ビルド／リクエスト内で1度だけ集計するキャッシュ（foreignStats と同方針）。
let statsCache: AreaStats | null = null;

/** 全 pref 横断の集計を返す（初回のみ構築してキャッシュ）。 */
export async function getAreaStats(): Promise<AreaStats> {
  if (!statsCache) {
    const { listAllAcrossPrefs } = await import("./metrics");
    statsCache = buildAreaStats(await listAllAcrossPrefs());
  }
  return statsCache;
}
