// analysis.json 生成。ChatGPT / Claude にそのまま渡せる、巨大化しない（上位N件に絞った）
// AI 分析用データセット。構造は仕様15. の例に準拠。

import { REPORT_TOP_N } from "../config";
import { round } from "../format";
import type { MetricsDiff } from "../aggregate";
import type { Metrics } from "../types";
import type { ReportBundle } from "./types";

function m(x: Metrics) {
  return { clicks: x.clicks, impressions: x.impressions, ctr: round(x.ctr, 4), position: round(x.position, 2) };
}

/** 前後比較（current/previous/差分）の共通形。pageTypes と urlSets が共有する。 */
function md(d: MetricsDiff) {
  return {
    current: m(d.current),
    previous: m(d.previous),
    clicksDelta: d.clicksDelta,
    impressionsDelta: d.impressionsDelta,
    ctrDelta: round(d.ctrDelta, 4),
    positionDelta: round(d.positionDelta, 2),
  };
}

export function buildAnalysisJson(b: ReportBundle): object {
  return {
    meta: {
      generatedAt: b.generatedAt,
      site: b.siteUrl,
      searchType: b.searchType,
      period: b.current,
      compare: b.compare ? { mode: b.compare.mode, period: b.compare.period } : null,
      dataNotes: b.dataNotes,
    },
    site: {
      current: m(b.site),
      previous: b.compare ? m(b.compare.site) : null,
      fixedWindows: {
        last7: {
          current: m(b.fixedWindows.last7.current),
          previous: m(b.fixedWindows.last7.previous),
        },
        last28: {
          current: m(b.fixedWindows.last28.current),
          previous: m(b.fixedWindows.last28.previous),
        },
      },
      daily: b.daily.map((d) => ({
        date: d.date,
        clicks: d.clicks,
        impressions: d.impressions,
        ctr: round(d.ctr, 4),
        position: round(d.position, 2),
        clicksMA7: round(d.clicksMA7, 2),
        impressionsMA7: round(d.impressionsMA7, 2),
      })),
    },
    pageTypes: b.pageTypes.map((p) => ({ pageType: p.pageType, pageCount: p.pageCount, ...m(p) })),
    queryCategories: b.queryCategories.map((q) => ({ category: q.category, queryCount: q.queryCount, ...m(q) })),
    municipalities: {
      coverage: b.muniCoverage,
      byStatus: Object.fromEntries(
        ["strong", "growing", "opportunity", "lowCtr", "weak", "noImpression", "other"].map((status) => [
          status,
          b.municipalities.filter((row) => row.status === status).length,
        ]),
      ),
      top: b.municipalities
        .filter((row) => row.impressions > 0)
        .slice(0, 100)
        .map((row) => ({
          code: row.code,
          name: row.name,
          prefSlug: row.prefSlug,
          prefNameJa: row.prefNameJa,
          url: row.url,
          status: row.status,
          queryCount: row.queryCount,
          ...m(row),
        })),
    },
    prefectures: b.prefectures.map((p) => ({
      prefSlug: p.prefSlug,
      prefNameJa: p.prefNameJa,
      municipalityCount: p.municipalityCount,
      exposedCount: p.exposedCount,
      exposureRate: round(p.exposureRate, 4),
      ...m(p),
    })),
    opportunities: {
      highImpressionLowCtr: b.opportunities.highImpressionLowCtr.slice(0, REPORT_TOP_N.lowCtr).map(oppJson),
      page2: b.opportunities.page2.slice(0, REPORT_TOP_N.page2).map(oppJson),
      nearTop: b.opportunities.nearTop.slice(0, REPORT_TOP_N.page2).map(oppJson),
      zeroClickHighImpression: b.opportunities.zeroClickHighImpression.slice(0, REPORT_TOP_N.page2).map(oppJson),
      positionImprove: b.compare?.positionImprove.slice(0, REPORT_TOP_N.winners).map(diffJson) ?? [],
      positionDecline: b.compare?.positionDecline.slice(0, REPORT_TOP_N.losers).map(diffJson) ?? [],
    },
    // 施策の効果検証用（--since / --baseline で本番反映日を挟んだときに意味を持つ）。
    effect: b.compare
      ? {
          mode: b.compare.mode,
          period: b.compare.period,
          warning: b.compare.warning ?? null,
          pageTypes: b.compare.pageTypes.map((d) => ({
            pageType: d.pageType,
            pageCount: d.pageCount,
            prevPageCount: d.prevPageCount,
            ...md(d),
          })),
          coverage: {
            ...b.compare.coverage,
            exposureRate: round(b.compare.coverage.exposureRate, 4),
            prevExposureRate: round(b.compare.coverage.prevExposureRate, 4),
            rateDelta: round(b.compare.coverage.rateDelta, 4),
          },
          urlSets: b.compare.urlSets.map((s) => ({
            name: s.name,
            pr: s.pr ?? null,
            note: s.note ?? null,
            // 比較期間がこのセットの本番反映日を挟んでいるか（false なら施策の効果ではない）
            straddlesDeploy: s.straddlesDeploy,
            matchedPages: s.matchedPages,
            prevMatchedPages: s.prevMatchedPages,
            ...md(s),
          })),
        }
      : null,
    winners: b.compare?.winners.slice(0, REPORT_TOP_N.winners).map(diffJson) ?? [],
    losers: b.compare?.losers.slice(0, REPORT_TOP_N.losers).map(diffJson) ?? [],
    newVisibilityPages: b.compare?.newVisibility.slice(0, REPORT_TOP_N.newVisibility).map(diffJson) ?? [],
    noImpressionPages: b.noImpressionMunicipalities.slice(0, REPORT_TOP_N.noImpressionPages).map((row) => ({
      code: row.code,
      name: row.name,
      prefSlug: row.prefSlug,
      prefNameJa: row.prefNameJa,
      url: row.url,
    })),
  };
}

function oppJson(r: {
  type: string;
  url: string;
  pageType: string;
  muniName?: string;
  prefNameJa?: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}) {
  return {
    type: r.type,
    url: r.url,
    pageType: r.pageType,
    muniName: r.muniName ?? null,
    prefNameJa: r.prefNameJa ?? null,
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: round(r.ctr, 4),
    position: round(r.position, 2),
  };
}

function diffJson(r: {
  url: string;
  pageType: string;
  muniName?: string;
  prefNameJa?: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  prevClicks: number;
  prevImpressions: number;
  prevPosition: number;
  clicksDelta: number;
  impressionsDelta: number;
  positionDelta: number;
}) {
  return {
    url: r.url,
    pageType: r.pageType,
    muniName: r.muniName ?? null,
    prefNameJa: r.prefNameJa ?? null,
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: round(r.ctr, 4),
    position: round(r.position, 2),
    prevClicks: r.prevClicks,
    prevImpressions: r.prevImpressions,
    prevPosition: round(r.prevPosition, 2),
    clicksDelta: r.clicksDelta,
    impressionsDelta: r.impressionsDelta,
    positionDelta: round(r.positionDelta, 2),
  };
}
