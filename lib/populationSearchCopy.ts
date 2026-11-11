import type { Municipality } from "./types";
import { POPULATION_FRESHNESS } from "./rankings";
import { prefNameOf } from "./site";

/** 2026-11の検索語調査に基づく2URLだけの文言。既存の他県・指標へ波及させない。 */
export function populationSearchCopy({ metric, pref, top, count, shown }: {
  metric: string;
  pref?: string;
  top?: Municipality;
  count: number;
  shown: number;
}): { title: string; description: string; lead: string } | null {
  if (metric !== "population-most" || (pref !== undefined && pref !== "mie") || !top || count <= 0) return null;
  const title = `${pref === "mie" ? "三重県" : "全国"}の市区町村人口ランキング（人口が多い順）`;
  const name = pref ? (top.displayName ?? top.name) : `${prefNameOf(top.pref)}${top.displayName ?? top.name}`;
  const leader = `1位は${name}（${top.population.toLocaleString("ja-JP")}人）。`;
  const coverage = pref ? `三重県内の${count}市町を掲載。` : `全国${count.toLocaleString("ja-JP")}市区町村を集計し、上位${shown}位を掲載。`;
  const method = `${POPULATION_FRESHNESS}の人口等基本集計に基づき、人口が多い順に比較できます。`;
  const definition = "政令指定都市は市全体を1件とし、行政区を重複計上しません。東京23特別区は各区を対象とします。";
  return { title, description: `${coverage}${leader}${method}`, lead: `${coverage}${leader}${method}${definition}` };
}
