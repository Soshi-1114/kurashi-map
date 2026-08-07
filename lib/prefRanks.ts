// 県内順位の集計レイヤー（詳細ページの「県内◯位」表示用）。全国順位は
// lib/rankingStats.ts が持つため、ここは同一都道府県内に限定した順位だけを扱う。
// rankingStats と同方針: ランキング定義（lib/rankings.ts）の qualifies / sortValue を
// 流用し、市区町村レベルのみ（政令市の行政区は順位を持たない）。

import { getRankingBySlug, muniLevelOnly, rankBy } from "./rankings";
import type { Municipality } from "./types";

/** 県内順位を持つ指標。値は流用するランキング定義の slug（population のみ population-most）。 */
export type PrefRankMetric = "population" | "rent-cheap" | "land-price-high" | "population-growth";

const METRIC_TO_SLUG: Record<PrefRankMetric, string> = {
  population: "population-most",
  "rent-cheap": "rent-cheap",
  "land-price-high": "land-price-high",
  "population-growth": "population-growth",
};

export type PrefRankPos = { rank: number; total: number };

/** 全自治体から、指標 → (code → 県内順位) の対応表を構築する。 */
export function buildPrefRanks(all: Municipality[]): Map<PrefRankMetric, Map<string, PrefRankPos>> {
  const munis = muniLevelOnly(all);
  const byPref = new Map<string, Municipality[]>();
  for (const m of munis) {
    const arr = byPref.get(m.pref);
    if (arr) arr.push(m);
    else byPref.set(m.pref, [m]);
  }

  const out = new Map<PrefRankMetric, Map<string, PrefRankPos>>();
  for (const metric of Object.keys(METRIC_TO_SLUG) as PrefRankMetric[]) {
    const def = getRankingBySlug(METRIC_TO_SLUG[metric]);
    const byCode = new Map<string, PrefRankPos>();
    if (def) {
      for (const [, list] of byPref) {
        const ranked = rankBy(def, list);
        ranked.forEach((m, i) => byCode.set(m.code, { rank: i + 1, total: ranked.length }));
      }
    }
    out.set(metric, byCode);
  }
  return out;
}

export type PrefRanks = Map<PrefRankMetric, Map<string, PrefRankPos>>;

// ビルド／リクエスト内で1度だけ集計するキャッシュ（rankingStats と同方針）。
let cache: PrefRanks | null = null;

/** 全 pref 横断の県内順位表を返す（初回のみ構築してキャッシュ）。 */
export async function getPrefRanks(): Promise<PrefRanks> {
  if (!cache) {
    const { listAllAcrossPrefs } = await import("./metrics");
    cache = buildPrefRanks(await listAllAcrossPrefs());
  }
  return cache;
}
