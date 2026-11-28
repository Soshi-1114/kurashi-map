import type { Municipality } from "./types";
import { POPULATION_ASOF, POPULATION_FRESHNESS } from "./rankings";
import { prefNameOf } from "./site";

const TARGET_PREFS = new Set(["mie", "yamaguchi", "shimane", "hyogo"]);

/** 検索語調査に基づく全国・対象県だけの文言。他県・他指標へ波及させない。 */
export function populationSearchCopy({ metric, pref, top, count, shown }: {
  metric: string;
  pref?: string;
  top?: Municipality;
  count: number;
  shown: number;
}): { title: string; description: string; lead: string; metaTitle?: string; answer?: string; basis?: string; sourceUrl?: string } | null {
  if (metric !== "population-most" || (pref !== undefined && !TARGET_PREFS.has(pref)) || !top || count <= 0) return null;
  const prefecture = pref ? prefNameOf(pref) : "全国";
  if (pref === "hyogo") {
    const name = top.displayName ?? top.name;
    const leader = `1位は${name}（${top.population.toLocaleString("ja-JP")}人）。`;
    const coverage = `${prefecture}内の${count}市町を掲載。`;
    const basis = `${POPULATION_ASOF}年10月1日現在の国勢調査・人口等基本集計（総人口・男女総数）に基づきます。政令指定都市は市全体を1件とし、行政区を重複計上しません。`;
    return {
      title: `${prefecture}の人口ランキング（市町別・多い順）`,
      metaTitle: `${prefecture}の人口ランキング【${POPULATION_FRESHNESS}】全${count}市町`,
      description: `${coverage}${leader}${basis}`,
      lead: `${coverage}${leader}${basis}`,
      answer: `1位 ${name} ${top.population.toLocaleString("ja-JP")}人／全${count}市町`,
      basis,
      sourceUrl: `https://www.stat.go.jp/data/kokusei/${POPULATION_ASOF}/kekka.html`,
    };
  }
  const title = pref === "yamaguchi" || pref === "shimane"
    ? `${prefecture}の人口ランキング（${pref === "yamaguchi" ? "市町" : "市町村"}別・多い順）`
    : `${prefecture}の市区町村人口ランキング（人口が多い順）`;
  const name = pref ? (top.displayName ?? top.name) : `${prefNameOf(top.pref)}${top.displayName ?? top.name}`;
  const leader = `1位は${name}（${top.population.toLocaleString("ja-JP")}人）。`;
  const coverage = pref ? `${prefecture}内の${count}${pref === "mie" || pref === "yamaguchi" ? "市町" : "市町村"}を掲載。` : `全国${count.toLocaleString("ja-JP")}市区町村を集計し、上位${shown}位を掲載。`;
  const method = `${POPULATION_FRESHNESS}の人口等基本集計に基づき、人口が多い順に比較できます。`;
  const definition = "政令指定都市は市全体を1件とし、行政区を重複計上しません。東京23特別区は各区を対象とします。";
  return { title, description: `${coverage}${leader}${method}`, lead: `${coverage}${leader}${method}${definition}` };
}
