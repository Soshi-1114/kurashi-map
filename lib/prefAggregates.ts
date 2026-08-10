// 都道府県ハブ（/area/{pref}）の「県のデータ概況」用の集計レイヤー。
//
// 指標の定義は lib/rankings.ts の RANKINGS を流用する（qualifies / sortValue / display /
// order を再実装しない）。県別ランキングページの「データ概況」が使っている medianOf と
// 同じ「県内中央値」を軸にし、その中央値で47都道府県を並べた順位を添える。
//
// なぜ平均ではなく中央値か: lib/areaStats.ts の県平均は「自治体を1票とする単純平均」で、
// 東京都なら港区と檜原村が同じ重みになる。値そのものを参考線として出すぶんには中立だが、
// 「全国◯位」という順序を主張する土台にすると重み付けの取り方で結論が変わってしまう。
// 中央値なら「県内の市区町村を値の順に並べた真ん中」と定義が一意に決まり、外れ値にも強い。
//
// 表裏のある指標（家賃が安い/高い 等）は同じ値の並べ替え違いなので、"高い順" の側だけを
// 使って順位の向きを全指標で揃える（「高い＝良い」という含意を持たせないため、UI では
// 必ず「高い順に全国◯位」と向きを明示すること）。

import { getRankingBySlug, medianOf, muniLevelOnly, rankBy } from "./rankings";
import type { Municipality } from "./types";

/** 概況に出す指標（RANKINGS の slug と、その指標を指す短いラベル）。 */
const SUMMARY_METRICS: { slug: string; label: string }[] = [
  { slug: "rent-high", label: "家賃平均" },
  { slug: "land-price-high", label: "地価（住宅地）" },
  { slug: "population-density", label: "人口密度" },
  { slug: "population-growth", label: "人口増減率" },
  { slug: "vacancy-high", label: "空き家率" },
  { slug: "foreign-ratio-high", label: "外国人住民比率" },
];

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
 * 戻り値は pref スラッグ → 指標サマリー配列（SUMMARY_METRICS の順）。
 */
export function buildPrefMetricSummaries(all: Municipality[]): Map<string, PrefMetricSummary[]> {
  const munis = muniLevelOnly(all);
  const byPref = new Map<string, Municipality[]>();
  for (const m of munis) {
    const list = byPref.get(m.pref);
    if (list) list.push(m);
    else byPref.set(m.pref, [m]);
  }

  const out = new Map<string, PrefMetricSummary[]>();
  for (const { slug, label } of SUMMARY_METRICS) {
    const def = getRankingBySlug(slug);
    if (!def) continue;

    // 県ごとの中央値自治体。該当データが1件も無い県はこの指標を持たない。
    const prefMedians: { pref: string; m: Municipality }[] = [];
    for (const [pref, list] of byPref) {
      const ranked = rankBy(def, list);
      if (ranked.length > 0) prefMedians.push({ pref, m: medianOf(ranked) });
    }
    // SUMMARY_METRICS は "高い順"（order: desc）の指標だけを選んでいる。
    prefMedians.sort((a, b) => def.sortValue(b.m) - def.sortValue(a.m));

    // 全国中央値は「全自治体を並べた真ん中」。県中央値の中央値ではない。
    const nationalRanked = rankBy(def, munis);
    const nationalText = nationalRanked.length > 0 ? def.display(medianOf(nationalRanked)) : "—";

    prefMedians.forEach(({ pref, m }, i) => {
      const list = out.get(pref) ?? [];
      list.push({
        slug,
        label,
        valueText: def.display(m),
        medianMuniName: m.displayName ?? m.name,
        nationalText,
        rank: i + 1,
        total: prefMedians.length,
      });
      out.set(pref, list);
    });
  }
  return out;
}

let cache: Map<string, PrefMetricSummary[]> | null = null;

/** 全 pref 横断の県別指標概況を返す（初回のみ構築してキャッシュ。rankingStats と同方針）。 */
export async function getPrefMetricSummaries(): Promise<Map<string, PrefMetricSummary[]>> {
  if (!cache) {
    const { listAllAcrossPrefs } = await import("./metrics");
    cache = buildPrefMetricSummaries(await listAllAcrossPrefs());
  }
  return cache;
}
