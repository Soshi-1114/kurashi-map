// pages.csv / queries.csv / page-query.csv 用の行データ構築。GSC 生データと分類関数から
// report 層の行形状（PageRow/QueryRow/PageQueryRow）を組み立てる。analyze.ts はこれを呼ぶだけにし、
// 行の組み立てロジック自体はオーケストレーション（analyze.ts）ではなくここに置く。

import { metricsFromRow } from "../aggregate";
import type { GscApiRow, Metrics, QueryCategory, UrlMeta } from "../types";
import type { PageQueryRow, PageRow, QueryRow } from "./types";

type ClassifyUrl = (url: string) => UrlMeta;
type ClassifyQuery = (q: string) => QueryCategory;

export function buildPageRows(pageMetrics: Map<string, Metrics>, classifyUrl: ClassifyUrl): PageRow[] {
  return [...pageMetrics.entries()].map(([url, m]) => ({ url, meta: classifyUrl(url), ...m }));
}

export function buildQueryRows(queryMetrics: Map<string, Metrics>, classifyQuery: ClassifyQuery): QueryRow[] {
  return [...queryMetrics.entries()].map(([query, m]) => ({ query, category: classifyQuery(query), ...m }));
}

export function buildPageQueryRows(
  pageQueryRows: GscApiRow[],
  classifyUrl: ClassifyUrl,
  classifyQuery: ClassifyQuery,
): PageQueryRow[] {
  return pageQueryRows.map((r) => ({
    url: r.keys[0],
    meta: classifyUrl(r.keys[0]),
    query: r.keys[1],
    category: classifyQuery(r.keys[1]),
    ...metricsFromRow(r),
  }));
}
