// 都道府県ハブ（/area/{pref}）の「県のデータ概況」用の集計レイヤー。
//
// 指標の定義は lib/rankings.ts の RANKINGS を流用する（qualifies / sortValue / display /
// columnLabel を再実装しない）。どの指標を概況に出すかも RankingDef の prefSummary フラグで
// 表明されているので、ここに slug のリストを持たない。県別ランキングページの「データ概況」が
// 使っている medianOf と同じ「県内中央値」を軸にし、その中央値で47都道府県を並べた順位を添える。
//
// なぜ平均ではなく中央値か: lib/areaStats.ts の県平均は「自治体を1票とする単純平均」で、
// 東京都なら港区と檜原村が同じ重みになる。値そのものを参考線として出すぶんには中立だが、
// 「全国◯位」という順序を主張する土台にすると重み付けの取り方で結論が変わってしまう。
// 中央値なら「県内の市区町村を値の順に並べた真ん中」と定義が一意に決まり、外れ値にも強い。

import { RANKINGS, groupByPref, medianOf, muniLevelOnly, rankBy } from "./rankings";
import { buildNationalMedians, getNationalMedians } from "./rankingStats";
import type { Municipality } from "./types";

/** 概況に出す指標（RANKINGS の並び順＝カテゴリ順のまま表示する）。 */
const SUMMARY_DEFS = RANKINGS.filter((r) => r.prefSummary);

export type PrefMetricSummary = {
  slug: string;
  label: string;
  /** 県内中央値の表示テキスト（def.display 由来） */
  valueText: string;
  /** 中央値に当たる自治体名（どの街の値かを示す） */
  medianMuniName: string;
  /** 全国中央値（全自治体の中央値）の表示テキスト */
  nationalText: string;
  /** 県内中央値で都道府県を「高い順」に並べたときの順位 */
  rank: number;
  /** 順位の母数（その指標に該当データがある都道府県数） */
  total: number;
};

/**
 * 全自治体から、都道府県ごとの指標概況を構築する。
 * 戻り値は pref スラッグ → 指標サマリー配列（SUMMARY_DEFS の順）。
 * 全国中央値は lib/rankingStats.ts と同じ導出を使う（省略時はここで組み立てる）。
 */
export function buildPrefMetricSummaries(
  all: Municipality[],
  nationalMedians: Map<string, Municipality> = buildNationalMedians(all),
): Map<string, PrefMetricSummary[]> {
  const byPref = groupByPref(muniLevelOnly(all));

  const out = new Map<string, PrefMetricSummary[]>();
  for (const def of SUMMARY_DEFS) {
    // 県ごとの中央値自治体。該当データが1件も無い県はこの指標を持たない。
    const prefMedians: { pref: string; m: Municipality }[] = [];
    for (const [pref, list] of byPref) {
      const ranked = rankBy(def, list);
      if (ranked.length > 0) prefMedians.push({ pref, m: medianOf(ranked) });
    }
    // 順位は def.order ではなく sortValue の降順で決めるため、向きは常に UI の「高い順」と一致する
    // （「高い＝良い」という含意を持たせないため、UI では必ず向きを明示すること）。
    prefMedians.sort((a, b) => def.sortValue(b.m) - def.sortValue(a.m));

    // 全国中央値は「全自治体を並べた真ん中」。県中央値の中央値ではない。
    const national = nationalMedians.get(def.slug);
    const nationalText = national ? def.display(national) : "—";

    prefMedians.forEach(({ pref, m }, i) => {
      const row: PrefMetricSummary = {
        slug: def.slug,
        label: def.columnLabel,
        valueText: def.display(m),
        medianMuniName: m.displayName ?? m.name,
        nationalText,
        rank: i + 1,
        total: prefMedians.length,
      };
      const list = out.get(pref);
      if (list) list.push(row);
      else out.set(pref, [row]);
    });
  }
  return out;
}

let cache: Map<string, PrefMetricSummary[]> | null = null;

/** 全 pref 横断の県別指標概況を返す（初回のみ構築してキャッシュ。rankingStats と同方針）。 */
export async function getPrefMetricSummaries(): Promise<Map<string, PrefMetricSummary[]>> {
  if (!cache) {
    const { listAllAcrossPrefs } = await import("./metrics");
    const [all, nationalMedians] = await Promise.all([listAllAcrossPrefs(), getNationalMedians()]);
    cache = buildPrefMetricSummaries(all, nationalMedians);
  }
  return cache;
}
