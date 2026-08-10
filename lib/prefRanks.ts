// 県内順位の集計レイヤー（詳細ページ・都道府県ページの「県内◯位」表示用）。全国順位は
// lib/rankingStats.ts が持つため、ここは同一都道府県内に限定した順位だけを扱う。
// rankingStats.buildRankPositions と同じ形（RANKINGS を全件イテレートし slug をキーにする）
// にすることで、ランキング定義の追加・slug変更に自動追従する（個別指標をハードコードしない）。

import { RANKINGS, groupByPref, muniLevelOnly, rankBy } from "./rankings";
import type { Municipality } from "./types";

export type PrefRankPos = { rank: number; total: number };

/** 全自治体から、ランキング slug → (code → 県内順位) の対応表を構築する。 */
export function buildPrefRanks(all: Municipality[]): Map<string, Map<string, PrefRankPos>> {
  const byPref = groupByPref(muniLevelOnly(all));

  const out = new Map<string, Map<string, PrefRankPos>>();
  for (const def of RANKINGS) {
    const byCode = new Map<string, PrefRankPos>();
    for (const [, list] of byPref) {
      const ranked = rankBy(def, list);
      ranked.forEach((m, i) => byCode.set(m.code, { rank: i + 1, total: ranked.length }));
    }
    out.set(def.slug, byCode);
  }
  return out;
}

export type PrefRanks = Map<string, Map<string, PrefRankPos>>;

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
