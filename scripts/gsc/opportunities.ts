// SEO Opportunity 抽出（仕様 7. Opportunity A〜G）と期間比較（Winners/Losers/新規露出）。
// すべてページ単位（page dimension の集計）で判定する。クエリ単位の詳細は page-query.csv に
// 別途出力されるので、ここでの目的は summary.md の「打ち手候補」を安定した粒度で出すこと。

import { EMPTY_METRICS } from "./aggregate";
import { OPPORTUNITY_THRESHOLDS } from "./config";
import type { Metrics, PageType, UrlMeta } from "./types";

export type OpportunityType =
  | "highImpressionLowCtr"
  | "page2"
  | "nearTop"
  | "zeroClickHighImpression"
  | "positionImprove"
  | "positionDecline"
  | "newVisibility";

export interface OpportunityRow extends Metrics {
  type: OpportunityType;
  url: string;
  pageType: PageType;
  muniName?: string;
  prefNameJa?: string;
  prevClicks?: number;
  prevImpressions?: number;
  prevPosition?: number;
  positionDelta?: number;
}

type ClassifyUrl = (url: string) => UrlMeta;

function baseRow(type: OpportunityType, url: string, m: Metrics, classifyUrl: ClassifyUrl): OpportunityRow {
  const meta = classifyUrl(url);
  return { type, url, pageType: meta.pageType, muniName: meta.muniName, prefNameJa: meta.prefNameJa, ...m };
}

/** pageMetrics を predicate で絞り込み、OpportunityRow の配列にする（並び替えは呼び出し側）。 */
function collectByPredicate(
  pageMetrics: Map<string, Metrics>,
  classifyUrl: ClassifyUrl,
  type: OpportunityType,
  predicate: (m: Metrics) => boolean,
): OpportunityRow[] {
  const out: OpportunityRow[] = [];
  for (const [url, m] of pageMetrics) {
    if (predicate(m)) out.push(baseRow(type, url, m, classifyUrl));
  }
  return out;
}

// --- Opportunity A: 高表示・低CTR ---
export function findHighImpressionLowCtr(
  pageMetrics: Map<string, Metrics>,
  classifyUrl: ClassifyUrl,
  t = OPPORTUNITY_THRESHOLDS.highImpressionLowCtr,
): OpportunityRow[] {
  return collectByPredicate(
    pageMetrics,
    classifyUrl,
    "highImpressionLowCtr",
    (m) => m.impressions >= t.minImpressions && m.position <= t.maxPosition && m.ctr < t.maxCtr,
  ).sort((a, b) => b.impressions - a.impressions);
}

// --- Opportunity B: 2ページ目上位（11〜15位を優先） ---
export function findPage2(
  pageMetrics: Map<string, Metrics>,
  classifyUrl: ClassifyUrl,
  t = OPPORTUNITY_THRESHOLDS.page2,
): OpportunityRow[] {
  return collectByPredicate(
    pageMetrics,
    classifyUrl,
    "page2",
    (m) => m.position >= t.minPosition && m.position <= t.maxPosition && m.impressions >= t.minImpressions,
  ).sort((a, b) => {
    const aPriority = a.position >= t.priorityMin && a.position <= t.priorityMax ? 0 : 1;
    const bPriority = b.position >= t.priorityMin && b.position <= t.priorityMax ? 0 : 1;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return b.impressions - a.impressions;
  });
}

// --- Opportunity C: 上位表示目前 ---
export function findNearTop(
  pageMetrics: Map<string, Metrics>,
  classifyUrl: ClassifyUrl,
  t = OPPORTUNITY_THRESHOLDS.nearTop,
): OpportunityRow[] {
  return collectByPredicate(
    pageMetrics,
    classifyUrl,
    "nearTop",
    (m) => m.position >= t.minPosition && m.position <= t.maxPosition && m.impressions >= t.minImpressions,
  ).sort((a, b) => a.position - b.position);
}

// --- Opportunity D: 表示回数が多いのにクリック0 ---
export function findZeroClickHighImpression(
  pageMetrics: Map<string, Metrics>,
  classifyUrl: ClassifyUrl,
  t = OPPORTUNITY_THRESHOLDS.zeroClickHighImpression,
): OpportunityRow[] {
  return collectByPredicate(
    pageMetrics,
    classifyUrl,
    "zeroClickHighImpression",
    (m) => m.clicks === 0 && m.impressions >= t.minImpressions,
  ).sort((a, b) => b.impressions - a.impressions);
}

// --- 期間比較（Opportunity E/F/G + Winners/Losers） ---

export interface PeriodDiffRow extends Metrics {
  url: string;
  pageType: PageType;
  muniName?: string;
  prefNameJa?: string;
  prevClicks: number;
  prevImpressions: number;
  prevCtr: number;
  prevPosition: number;
  clicksDelta: number;
  impressionsDelta: number;
  /** prevPosition - position。正の値=順位改善（数値が小さくなった）。 */
  positionDelta: number;
}

export function comparePages(
  current: Map<string, Metrics>,
  prev: Map<string, Metrics>,
  classifyUrl: ClassifyUrl,
): PeriodDiffRow[] {
  const urls = new Set([...current.keys(), ...prev.keys()]);
  const rows: PeriodDiffRow[] = [];
  for (const url of urls) {
    const c = current.get(url) ?? EMPTY_METRICS;
    const p = prev.get(url) ?? EMPTY_METRICS;
    const meta = classifyUrl(url);
    rows.push({
      ...c,
      url,
      pageType: meta.pageType,
      muniName: meta.muniName,
      prefNameJa: meta.prefNameJa,
      prevClicks: p.clicks,
      prevImpressions: p.impressions,
      prevCtr: p.ctr,
      prevPosition: p.position,
      clicksDelta: c.clicks - p.clicks,
      impressionsDelta: c.impressions - p.impressions,
      positionDelta: p.impressions > 0 && c.impressions > 0 ? p.position - c.position : 0,
    });
  }
  return rows;
}

/** sign=1: 増加順（Winners）/ sign=-1: 減少順（Losers）。 */
function topByClicksDelta(diffRows: PeriodDiffRow[], n: number, sign: 1 | -1): PeriodDiffRow[] {
  return [...diffRows]
    .filter((r) => sign * r.clicksDelta > 0)
    .sort((a, b) => sign * (b.clicksDelta - a.clicksDelta))
    .slice(0, n);
}

export function topWinners(diffRows: PeriodDiffRow[], n: number): PeriodDiffRow[] {
  return topByClicksDelta(diffRows, n, 1);
}

export function topLosers(diffRows: PeriodDiffRow[], n: number): PeriodDiffRow[] {
  return topByClicksDelta(diffRows, n, -1);
}

// --- Opportunity E: 順位急上昇 ---
export function findPositionImprove(
  diffRows: PeriodDiffRow[],
  t = OPPORTUNITY_THRESHOLDS.positionChange,
): PeriodDiffRow[] {
  return diffRows
    .filter((r) => r.prevImpressions > 0 && r.impressions >= t.minImpressions && r.positionDelta >= t.minDelta)
    .sort((a, b) => b.positionDelta - a.positionDelta);
}

// --- Opportunity F: 順位急落 ---
export function findPositionDecline(
  diffRows: PeriodDiffRow[],
  t = OPPORTUNITY_THRESHOLDS.positionChange,
): PeriodDiffRow[] {
  return diffRows
    .filter((r) => r.prevImpressions >= t.minImpressions && r.impressions > 0 && -r.positionDelta >= t.minDelta)
    .sort((a, b) => a.positionDelta - b.positionDelta);
}

// --- Opportunity G: 新規露出 ---
export function findNewVisibility(
  diffRows: PeriodDiffRow[],
  t = OPPORTUNITY_THRESHOLDS.newVisibility,
): PeriodDiffRow[] {
  return diffRows
    .filter((r) => r.prevImpressions === 0 && r.impressions >= t.minImpressions)
    .sort((a, b) => b.impressions - a.impressions);
}
