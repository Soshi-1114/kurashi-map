// 外国人住民比率の「解釈補助線」用の集計レイヤー。自治体ページとランキングが
// 共通で使う、全国平均・都道府県平均・順位（比率の高い順）を実データから算出する。
//
// honesty 方針: 平均・順位はすべて在留外国人統計＋国勢調査人口の実データから集計し、
// 推計・補完はしない。算出できない自治体（対象外・人口不明）は対象から外す。
// 中立性: 比率は「多様性・国際性の目安」として中立に提示し、順位ラベルも
// 「比率の高い順」という事実表現にとどめる（住みやすさ等の価値判断に紐づけない）。

import type { Municipality } from "./types";
import { foreignRatioPct, hasForeignData } from "./foreignResidents";

// 全国平均との差が ±このポイント以内なら「同程度」とみなす（マジックナンバー回避の定数）。
export const FOREIGN_RATIO_SAME_BAND_PT = 0.5;

export type AvgBand = "higher" | "lower" | "similar";

// 自治体1件ぶんの解釈補助線（全国平均・県平均・順位）。すべて実データ由来。
export type ForeignComparison = {
  /** 当該自治体の外国人住民比率（%） */
  ratio: number;
  /** 全国平均（在留外国人総数 ÷ 総人口 ×100、市区町村レベルの加重平均） */
  nationalAvg: number;
  /** 都道府県平均（同じく加重平均） */
  prefAvg: number;
  /** 全国順位（比率の高い順） */
  nationalRank: number;
  /** 全国の対象自治体数 */
  nationalTotal: number;
  /** 都道府県内順位（比率の高い順） */
  prefRank: number;
  /** 都道府県内の対象自治体数 */
  prefTotal: number;
  /** 出典の基準年（在留外国人統計の asOf） */
  asOf: string;
};

// 集計対象＝市区町村レベル（行政区を除外）かつ在留外国人統計の対象、人口が有効。
// ランキング（lib/rankings.ts）の muniLevelOnly と同じ「1自治体1エントリ」方針。
function qualified(all: Municipality[]): Municipality[] {
  return all.filter(
    (m) =>
      (m.level ?? "muni") !== "ward" &&
      hasForeignData(m.foreignResidents.source) &&
      m.population > 0,
  );
}

// 加重平均（Σ在留外国人 ÷ Σ人口 ×100）。単純平均ではなく実人数ベースの比率。
function weightedAvg(munis: Municipality[]): number {
  let foreign = 0;
  let pop = 0;
  for (const m of munis) {
    foreign += m.foreignResidents.value;
    pop += m.population;
  }
  return pop > 0 ? (foreign / pop) * 100 : 0;
}

/**
 * 全自治体から code → 解釈補助線の対応表を構築する。全国平均・県平均・全国順位・
 * 県内順位をまとめて1度だけ計算する（ページごとの再集計を避ける）。
 */
export function buildForeignStats(all: Municipality[]): Map<string, ForeignComparison> {
  const munis = qualified(all);
  const nationalAvg = weightedAvg(munis);
  const nationalTotal = munis.length;

  // 全国順位（比率の高い順）。
  const natRank = new Map<string, number>();
  [...munis]
    .sort((a, b) => foreignRatioPct(b) - foreignRatioPct(a))
    .forEach((m, i) => natRank.set(m.code, i + 1));

  // 県別にまとめ、県平均と県内順位を算出。
  const byPref = new Map<string, Municipality[]>();
  for (const m of munis) {
    const arr = byPref.get(m.pref);
    if (arr) arr.push(m);
    else byPref.set(m.pref, [m]);
  }

  const result = new Map<string, ForeignComparison>();
  for (const [, list] of byPref) {
    const prefAvg = weightedAvg(list);
    [...list]
      .sort((a, b) => foreignRatioPct(b) - foreignRatioPct(a))
      .forEach((m, i) => {
        result.set(m.code, {
          ratio: foreignRatioPct(m),
          nationalAvg,
          prefAvg,
          nationalRank: natRank.get(m.code) ?? 0,
          nationalTotal,
          prefRank: i + 1,
          prefTotal: list.length,
          asOf: m.foreignResidents.asOf,
        });
      });
  }
  return result;
}

// 比率が平均より高め／低め／同程度か（マジックナンバー回避の閾値で判定）。
export function avgBand(ratio: number, avg: number): AvgBand {
  if (ratio >= avg + FOREIGN_RATIO_SAME_BAND_PT) return "higher";
  if (ratio <= avg - FOREIGN_RATIO_SAME_BAND_PT) return "lower";
  return "similar";
}

// ビルド／リクエスト内で集計を1度だけ行うためのキャッシュ。
let statsCache: Map<string, ForeignComparison> | null = null;

/** 全 pref 横断の集計を返す（初回のみ構築してキャッシュ）。 */
export async function getForeignStats(): Promise<Map<string, ForeignComparison>> {
  if (!statsCache) {
    const { listAllAcrossPrefs } = await import("./metrics");
    statsCache = buildForeignStats(await listAllAcrossPrefs());
  }
  return statsCache;
}
