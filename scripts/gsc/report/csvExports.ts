// reports/gsc/{date}/*.csv の書き出し。列定義をここに集約する。

import path from "node:path";
import { writeCsvFile, type CsvColumn } from "../csv";
import { round } from "../format";
import type { Metrics } from "../types";
import type { ReportBundle } from "./types";

// clicks/impressions/ctr/position の4列（どの行にも共通）。
function metricColumns<T extends Metrics>(): CsvColumn<T>[] {
  return [
    { key: "clicks", header: "clicks", value: (r) => r.clicks },
    { key: "impressions", header: "impressions", value: (r) => r.impressions },
    { key: "ctr", header: "ctr", value: (r) => round(r.ctr, 4) },
    { key: "position", header: "position", value: (r) => round(r.position, 2) },
  ];
}

export function writeAllCsvs(outDir: string, b: ReportBundle): void {
  writeCsvFile(path.join(outDir, "daily.csv"), b.daily, [
    { key: "date", header: "date", value: (r) => r.date },
    ...metricColumns(),
    { key: "clicksMA7", header: "clicksMA7", value: (r) => round(r.clicksMA7, 2) },
    { key: "impressionsMA7", header: "impressionsMA7", value: (r) => round(r.impressionsMA7, 2) },
  ]);

  writeCsvFile(path.join(outDir, "pages.csv"), b.pages, [
    { key: "url", header: "url", value: (r) => r.url },
    { key: "pageType", header: "pageType", value: (r) => r.meta.pageType },
    { key: "prefSlug", header: "prefSlug", value: (r) => r.meta.prefSlug },
    { key: "prefNameJa", header: "prefNameJa", value: (r) => r.meta.prefNameJa },
    { key: "muniCode", header: "muniCode", value: (r) => r.meta.muniCode },
    { key: "muniName", header: "muniName", value: (r) => r.meta.muniName },
    ...metricColumns(),
  ]);

  writeCsvFile(path.join(outDir, "queries.csv"), b.queries, [
    { key: "query", header: "query", value: (r) => r.query },
    { key: "category", header: "category", value: (r) => r.category },
    ...metricColumns(),
  ]);

  writeCsvFile(path.join(outDir, "page-query.csv"), b.pageQueries, [
    { key: "url", header: "url", value: (r) => r.url },
    { key: "pageType", header: "pageType", value: (r) => r.meta.pageType },
    { key: "muniName", header: "muniName", value: (r) => r.meta.muniName },
    { key: "query", header: "query", value: (r) => r.query },
    { key: "category", header: "category", value: (r) => r.category },
    ...metricColumns(),
  ]);

  writeCsvFile(path.join(outDir, "municipalities.csv"), b.municipalities, [
    { key: "code", header: "code", value: (r) => r.code },
    { key: "name", header: "name", value: (r) => r.name },
    { key: "prefSlug", header: "prefSlug", value: (r) => r.prefSlug },
    { key: "prefNameJa", header: "prefNameJa", value: (r) => r.prefNameJa },
    { key: "url", header: "url", value: (r) => r.url },
    ...metricColumns(),
    { key: "queryCount", header: "queryCount", value: (r) => r.queryCount },
    { key: "status", header: "status", value: (r) => r.status },
  ]);

  writeCsvFile(path.join(outDir, "prefectures.csv"), b.prefectures, [
    { key: "prefSlug", header: "prefSlug", value: (r) => r.prefSlug },
    { key: "prefNameJa", header: "prefNameJa", value: (r) => r.prefNameJa },
    { key: "municipalityCount", header: "municipalityCount", value: (r) => r.municipalityCount },
    { key: "exposedCount", header: "exposedCount", value: (r) => r.exposedCount },
    { key: "exposureRate", header: "exposureRate", value: (r) => round(r.exposureRate, 4) },
    ...metricColumns(),
  ]);

  interface OppCsvRow extends Metrics {
    type: string;
    url: string;
    pageType: string;
    muniName?: string;
    prefNameJa?: string;
    prevClicks?: number;
    prevImpressions?: number;
    prevPosition?: number;
    positionDelta?: number;
  }
  const oppRows: OppCsvRow[] = [
    ...b.opportunities.highImpressionLowCtr,
    ...b.opportunities.page2,
    ...b.opportunities.nearTop,
    ...b.opportunities.zeroClickHighImpression,
    ...(b.compare?.positionImprove.map((r) => ({ ...r, type: "positionImprove" })) ?? []),
    ...(b.compare?.positionDecline.map((r) => ({ ...r, type: "positionDecline" })) ?? []),
    ...(b.compare?.newVisibility.map((r) => ({ ...r, type: "newVisibility" })) ?? []),
  ];
  writeCsvFile(path.join(outDir, "opportunities.csv"), oppRows, [
    { key: "type", header: "type", value: (r) => r.type },
    { key: "url", header: "url", value: (r) => r.url },
    { key: "pageType", header: "pageType", value: (r) => r.pageType },
    { key: "muniName", header: "muniName", value: (r) => r.muniName },
    { key: "prefNameJa", header: "prefNameJa", value: (r) => r.prefNameJa },
    ...metricColumns(),
    { key: "prevClicks", header: "prevClicks", value: (r) => r.prevClicks },
    { key: "prevImpressions", header: "prevImpressions", value: (r) => r.prevImpressions },
    { key: "prevPosition", header: "prevPosition", value: (r) => (r.prevPosition === undefined ? undefined : round(r.prevPosition, 2)) },
    { key: "positionDelta", header: "positionDelta", value: (r) => (r.positionDelta === undefined ? undefined : round(r.positionDelta, 2)) },
  ]);

  writeCsvFile(path.join(outDir, "no-impression-pages.csv"), b.noImpressionMunicipalities, [
    { key: "code", header: "code", value: (r) => r.code },
    { key: "name", header: "name", value: (r) => r.name },
    { key: "prefSlug", header: "prefSlug", value: (r) => r.prefSlug },
    { key: "prefNameJa", header: "prefNameJa", value: (r) => r.prefNameJa },
    { key: "url", header: "url", value: (r) => r.url },
  ]);
}
