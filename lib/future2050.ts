// 「2050年の暮らし」ビュー（自治体詳細の将来人口カード拡張）の派生テキスト。
//
// 北極星「現在×将来を1画面」の実装: 新しいデータは持ち込まず、収録済みの
// IPSS 将来推計・住基年齢構成・財政力指数・保育余裕率・空き家率を1つの文脈に束ねる。
// 文章はすべて実データからの決定論生成で、評価語（住みやすい/危険 等）は使わない
// （lib/insights.ts と同じ方針）。推計値には必ず「推計」を明記する。
//
// 基準の異なる値（住基の現在値 vs 2020年国調基準の推計）は並記に留め、
// 差分の演算表示はしない（詳細ページの高齢化率並記と同じ判断）。

import type { Municipality } from "./types";
import type { AreaStats } from "./areaStats";
import { hasFuturePopulation, ageComposition2050 } from "./futurePopulation";
import { workingRatioPct } from "./ageStats";
import { hasFiscal, isFiscalSpecialWard, fiscalIndexText } from "./fiscal";
import { hasChildcareCapacity, childcareOpenRatioText } from "./childcare";
import { hasVacancy, vacancyRateText } from "./vacancy";

/**
 * 2050年の年齢構成に関する決定論インサイト（0〜2文）。カード既表示の値の再掲は
 * 避け、「翻訳」（N人に1人）と「今との並記」（働き手世代の現在値）という
 * 読み解きだけを返す（総数・増減率・年齢構成の素の比率はカード本体が表示済み）。
 */
export function buildFuture2050Insights(m: Municipality): string[] {
  const fp = m.futurePopulation;
  if (!hasFuturePopulation(fp)) return [];
  const ages = ageComposition2050(fp);
  if (!ages) return [];
  const out: string[] = [];

  // 高齢者比率を「およそX人に1人」へ翻訳する（比率のままより体感に近い表現。
  // 丸めは Math.round で、X=1（比率100%超）は起こり得ない）。
  if (ages.elderly > 0) {
    const perN = Math.round(100 / ages.elderly);
    out.push(
      `2050年には住民のおよそ${perN}人に1人（${ages.elderly.toFixed(1)}%）が65歳以上になる推計です。`,
    );
  }

  // 生産年齢（働き手世代）の今とこれから。現在の住基ベース比率が取れる場合のみ、
  // 基準の違いを明記して並記する（比較の文脈では2050年値の再掲が必要）。
  const workingNow = workingRatioPct(m.ageStats);
  if (workingNow != null) {
    out.push(
      `働き手世代（15〜64歳）は現在の${workingNow.toFixed(1)}%（住民基本台帳）から2050年には総人口の${ages.working.toFixed(1)}%となる推計です（調査基準が異なる参考比較）。`,
    );
  }

  return out;
}

export type CapacityItem = {
  label: string;
  value: string;
  /** 全国平均などの比較文脈（注記の文章に使う）。比較情報が無い指標は省略。 */
  context?: string;
};

/**
 * 「変化を受け止める暮らしの体力」= 人口構成の変化に対する現在の備えとして、
 * 収録済みの現況指標（財政・保育・住宅ストック）を将来文脈で束ねる。
 * すべて現在の公表実データの再掲であり、新しい評価・スコアは作らない。
 * データのない指標は行ごと出さない（欠損を推計しない honesty 方針）。
 * 全国平均は既存の集計レイヤー（getAreaStats）をそのまま受ける。
 */
export function buildCapacityItems(m: Municipality, stats: AreaStats): CapacityItem[] {
  const out: CapacityItem[] = [];

  // 財政力指数（特別区は算定制度が異なるため財政カード側の注記に委ね、ここでは出さない）
  if (hasFiscal(m.fiscal) && !isFiscalSpecialWard(m.fiscal)) {
    const avg = stats.fiscalIndex.national;
    out.push({
      label: "財政力指数",
      value: fiscalIndexText(m.fiscal),
      ...(avg != null ? { context: `全国市町村平均は${avg.toFixed(2)}` } : {}),
    });
  }

  // 保育の定員余裕率（定員のある自治体のみ。政令市の区は市全体の集計値）
  if (hasChildcareCapacity(m.childcare)) {
    out.push({
      label: "保育の定員余裕率",
      value: childcareOpenRatioText(m.childcare),
    });
  }

  // 空き家率（住宅ストックの余剰。集計対象外の町村は出さない）
  if (hasVacancy(m.vacancy)) {
    const avg = stats.vacancyRate.national;
    out.push({
      label: "空き家率",
      value: vacancyRateText(m.vacancy),
      ...(avg != null ? { context: `全国平均は${avg.toFixed(1)}%` } : {}),
    });
  }

  return out;
}
