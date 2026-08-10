// 集計ロジック本体。すべて純粋関数（GSC API レスポンスと分類関数だけを受け取り、
// I/O を持たない）にして tests/scripts/gsc/aggregate.test.ts でユニットテストする。
//
// 指標の再計算方針: ctr / position は行ごとの値を単純平均せず、必ず
//   ctr = 総clicks / 総impressions
//   position = Σ(position × impressions) / 総impressions
// で導出する（GSC の仕様と同じ、impressions 加重）。

import { MUNI_STATUS_THRESHOLDS } from "./config";
import type { GscApiRow, Metrics, MuniMeta, PageType, QueryCategory, UrlMeta } from "./types";

interface Accum {
  clicks: number;
  impressions: number;
  posWeighted: number;
}

function newAccum(): Accum {
  return { clicks: 0, impressions: 0, posWeighted: 0 };
}
function addRowToAccum(acc: Accum, row: GscApiRow): void {
  acc.clicks += row.clicks;
  acc.impressions += row.impressions;
  acc.posWeighted += row.position * row.impressions;
}
function addMetricsToAccum(acc: Accum, m: Metrics): void {
  acc.clicks += m.clicks;
  acc.impressions += m.impressions;
  acc.posWeighted += m.position * m.impressions;
}
function finalizeAccum(acc: Accum): Metrics {
  return {
    clicks: acc.clicks,
    impressions: acc.impressions,
    ctr: acc.impressions > 0 ? acc.clicks / acc.impressions : 0,
    position: acc.impressions > 0 ? acc.posWeighted / acc.impressions : 0,
  };
}

export const EMPTY_METRICS: Metrics = { clicks: 0, impressions: 0, ctr: 0, position: 0 };

export function totalMetrics(rows: GscApiRow[]): Metrics {
  const acc = newAccum();
  for (const r of rows) addRowToAccum(acc, r);
  return finalizeAccum(acc);
}

/** 1行 = 1組み合わせが保証された行（例: page×query）を、そのまま Metrics に変換する。 */
export function metricsFromRow(row: GscApiRow): Metrics {
  return {
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.impressions > 0 ? row.clicks / row.impressions : 0,
    position: row.position,
  };
}

export function metricsFromDailyPoints(points: DailyPoint[]): Metrics {
  const acc = newAccum();
  for (const p of points) {
    acc.clicks += p.clicks;
    acc.impressions += p.impressions;
    acc.posWeighted += p.position * p.impressions;
  }
  return finalizeAccum(acc);
}

/** rows を keyFn の戻り値でグルーピングし、キーごとの Metrics を返す。 */
export function groupByKey<T extends string>(rows: GscApiRow[], keyFn: (r: GscApiRow) => T): Map<T, Metrics> {
  const accs = new Map<T, Accum>();
  for (const r of rows) {
    const k = keyFn(r);
    let a = accs.get(k);
    if (!a) {
      a = newAccum();
      accs.set(k, a);
    }
    addRowToAccum(a, r);
  }
  const out = new Map<T, Metrics>();
  for (const [k, a] of accs) out.set(k, finalizeAccum(a));
  return out;
}

// ===== A. 日別サイト全体 =====

export interface DailyPoint extends Metrics {
  date: string;
  clicksMA7: number;
  impressionsMA7: number;
}

export function buildDailySeries(dateRows: GscApiRow[]): DailyPoint[] {
  const byDate = groupByKey(dateRows, (r) => r.keys[0]);
  const dates = [...byDate.keys()].sort();
  const points = dates.map((date) => ({ date, ...(byDate.get(date) as Metrics) }));
  return points.map((p, i) => {
    const windowPoints = points.slice(Math.max(0, i - 6), i + 1);
    const clicksMA7 = windowPoints.reduce((s, w) => s + w.clicks, 0) / windowPoints.length;
    const impressionsMA7 = windowPoints.reduce((s, w) => s + w.impressions, 0) / windowPoints.length;
    return { ...p, clicksMA7, impressionsMA7 };
  });
}

// ===== B. ページ別 / ページタイプ別 =====

export interface PageTypeAgg extends Metrics {
  pageType: PageType;
  pageCount: number;
}

export function aggregatePageTypes(
  pageRows: GscApiRow[],
  classifyUrl: (url: string) => UrlMeta,
): PageTypeAgg[] {
  const byType = new Map<PageType, Accum>();
  const distinctPages = new Map<PageType, Set<string>>();
  for (const r of pageRows) {
    const url = r.keys[0];
    const pageType = classifyUrl(url).pageType;
    let a = byType.get(pageType);
    if (!a) {
      a = newAccum();
      byType.set(pageType, a);
    }
    addRowToAccum(a, r);
    let s = distinctPages.get(pageType);
    if (!s) {
      s = new Set();
      distinctPages.set(pageType, s);
    }
    s.add(url);
  }
  return [...byType.entries()]
    .map(([pageType, a]) => ({ pageType, ...finalizeAccum(a), pageCount: distinctPages.get(pageType)?.size ?? 0 }))
    .sort((a, b) => b.clicks - a.clicks);
}

// ===== C. クエリカテゴリ =====

export interface QueryCategoryAgg extends Metrics {
  category: QueryCategory;
  queryCount: number;
}

export function aggregateQueryCategories(
  queryRows: GscApiRow[],
  classifyQuery: (q: string) => QueryCategory,
): QueryCategoryAgg[] {
  const byCat = new Map<QueryCategory, Accum>();
  const distinct = new Map<QueryCategory, Set<string>>();
  for (const r of queryRows) {
    const q = r.keys[0];
    const cat = classifyQuery(q);
    let a = byCat.get(cat);
    if (!a) {
      a = newAccum();
      byCat.set(cat, a);
    }
    addRowToAccum(a, r);
    let s = distinct.get(cat);
    if (!s) {
      s = new Set();
      distinct.set(cat, s);
    }
    s.add(q);
  }
  return [...byCat.entries()]
    .map(([category, a]) => ({ category, ...finalizeAccum(a), queryCount: distinct.get(category)?.size ?? 0 }))
    .sort((a, b) => b.clicks - a.clicks);
}

// ===== D. 自治体ページ =====

export type MuniStatus = "noImpression" | "weak" | "opportunity" | "lowCtr" | "growing" | "strong" | "other";

/**
 * 自治体ページのステータス判定。複数条件に該当し得るため優先順位で1つに決める
 * （データが無い/薄いことの検出を最優先し、次に「打ち手が明確な」opportunity/lowCtr、
 * 　その後に期間比較の growing、最後に安定成長の strong）。閾値は config.ts で調整可能。
 */
export function classifyMuniStatus(
  current: Metrics,
  prev: Metrics | null,
  t = MUNI_STATUS_THRESHOLDS,
): MuniStatus {
  if (current.impressions === 0) return "noImpression";
  if (current.impressions < t.weakMaxImpressions) return "weak";
  if (current.position >= t.opportunityMinPosition && current.position <= t.opportunityMaxPosition) {
    return "opportunity";
  }
  if (
    current.position <= t.lowCtrMaxPosition &&
    current.ctr < t.lowCtrMaxCtr &&
    current.impressions >= t.lowCtrMinImpressions
  ) {
    return "lowCtr";
  }
  if (prev && prev.impressions > 0) {
    const clicksDeltaPct = prev.clicks > 0 ? (current.clicks - prev.clicks) / prev.clicks : current.clicks > 0 ? 1 : 0;
    const positionImprove = prev.position - current.position;
    if (clicksDeltaPct >= t.growingMinClicksDeltaPct || positionImprove >= t.growingMinPositionImprove) {
      return "growing";
    }
  }
  if (current.clicks >= t.strongMinClicks) return "strong";
  return "other";
}

export interface MuniAgg extends Metrics {
  code: string;
  name: string;
  prefSlug: string;
  prefNameJa: string;
  url: string;
  queryCount: number;
  status: MuniStatus;
}

export interface MuniCoverage {
  total: number;
  exposed: number;
  noImpression: number;
  exposureRate: number;
}

/**
 * 自治体マスタ（KurashiMap 側の全 URL）を基準に、GSC 側のページ別指標と突き合わせる。
 * GSC に一度も出てこない自治体（= impressions が無い）も「0行」として必ず1行出力するため、
 * 「表示回数0で GSC データに存在しない」ページを検出できる（仕様 9. の要件）。
 */
export function aggregateMunicipalities(
  pageMetrics: Map<string, Metrics>,
  pageQueryRows: GscApiRow[],
  muniMaster: Map<string, MuniMeta>,
  prevPageMetrics: Map<string, Metrics> | null,
): { rows: MuniAgg[]; coverage: MuniCoverage } {
  const queryCountByPath = new Map<string, Set<string>>();
  for (const r of pageQueryRows) {
    const p = r.keys[0];
    const q = r.keys[1];
    let s = queryCountByPath.get(p);
    if (!s) {
      s = new Set();
      queryCountByPath.set(p, s);
    }
    s.add(q);
  }

  const rows: MuniAgg[] = [];
  let exposed = 0;
  for (const meta of muniMaster.values()) {
    const metrics = pageMetrics.get(meta.url) ?? EMPTY_METRICS;
    const prev = prevPageMetrics ? prevPageMetrics.get(meta.url) ?? EMPTY_METRICS : null;
    const status = classifyMuniStatus(metrics, prev);
    if (metrics.impressions > 0) exposed++;
    rows.push({
      ...metrics,
      code: meta.code,
      name: meta.name,
      prefSlug: meta.prefSlug,
      prefNameJa: meta.prefNameJa,
      url: meta.url,
      queryCount: queryCountByPath.get(meta.url)?.size ?? 0,
      status,
    });
  }
  const total = muniMaster.size;
  return {
    rows: rows.sort((a, b) => b.clicks - a.clicks),
    coverage: { total, exposed, noImpression: total - exposed, exposureRate: total > 0 ? exposed / total : 0 },
  };
}

// ===== 都道府県別 =====

export interface PrefAgg extends Metrics {
  prefSlug: string;
  prefNameJa: string;
  municipalityCount: number;
  exposedCount: number;
  exposureRate: number;
}

export function aggregatePrefectures(muniRows: MuniAgg[]): PrefAgg[] {
  const byPref = new Map<string, MuniAgg[]>();
  for (const m of muniRows) {
    const arr = byPref.get(m.prefSlug);
    if (arr) arr.push(m);
    else byPref.set(m.prefSlug, [m]);
  }
  const out: PrefAgg[] = [];
  for (const [slug, list] of byPref) {
    const acc = newAccum();
    let exposed = 0;
    for (const m of list) {
      addMetricsToAccum(acc, m);
      if (m.impressions > 0) exposed++;
    }
    out.push({
      ...finalizeAccum(acc),
      prefSlug: slug,
      prefNameJa: list[0].prefNameJa,
      municipalityCount: list.length,
      exposedCount: exposed,
      exposureRate: list.length > 0 ? exposed / list.length : 0,
    });
  }
  return out.sort((a, b) => b.clicks - a.clicks);
}
