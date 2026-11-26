/** 福岡の人口ランキングだけで、広告の後にある続きを観測する。 */
export const RANKING_REST_PATH = "/ranking/population-most/fukuoka";
export const RANKING_REST_VERSION = "ranking-rest-v1";
export const RANKING_REST_VARIANTS = ["fukuoka-rest-baseline", "fukuoka-rest-before-ad"] as const;
export type RankingRestVariant = typeof RANKING_REST_VARIANTS[number];
export const RANKING_REST_EVENTS = ["ranking_rest_control_view", "ranking_rest_open", "ranking_rest_view"] as const;
export type RankingRestEvent = typeof RANKING_REST_EVENTS[number];

export function isRankingRestTarget(metric: string, pref?: string) {
  return metric === "population-most" && pref === "fukuoka";
}
