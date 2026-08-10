// 集計ロジック本体。すべて純粋関数（GSC API レスポンスと分類関数だけを受け取り、
// I/O を持たない）にして tests/scripts/gsc/aggregate.test.ts でユニットテストする。
//
// 指標の再計算方針: ctr / position は行ごとの値を単純平均せず、必ず
//   ctr = 総clicks / 総impressions
//   position = Σ(position × impressions) / 総impressions
// で導出する（GSC の仕様と同じ、impressions 加重）。

import { MA_WINDOW_DAYS, MUNI_STATUS_THRESHOLDS } from "./config";
import type { GscApiRow, Metrics, MuniMeta, PageType, QueryCategory, UrlMeta } from "./types";

interface Accum {
  clicks: number;
  impressions: number;
  posWeighted: number;
}

function newAccum(): Accum {
  return { clicks: 0, impressions: 0, posWeighted: 0 };
}
/** GscApiRow・Metrics どちらも clicks/impressions/position を持つ（構造的部分型）ので共用する。 */
function addToAccum(acc: Accum, x: { clicks: number; impressions: number; position: number }): void {
  acc.clicks += x.clicks;
  acc.impressions += x.impressions;
  acc.posWeighted += x.position * x.impressions;
}
function finalizeAccum(acc: Accum): Metrics {
  return {
    clicks: acc.clicks,
    impressions: acc.impressions,
    ctr: acc.impressions > 0 ? acc.clicks / acc.impressions : 0,
    position: acc.impressions > 0 ? acc.posWeighted / acc.impressions : 0,
  };
}

/** Map の get-or-insert。無ければ make() で作って登録し、その値を返す。 */
function getOrInsert<K, V>(map: Map<K, V>, key: K, make: () => V): V {
  let v = map.get(key);
  if (v === undefined) {
    v = make();
    map.set(key, v);
  }
  return v;
}

export const EMPTY_METRICS: Metrics = { clicks: 0, impressions: 0, ctr: 0, position: 0 };

export function totalMetrics(rows: GscApiRow[]): Metrics {
  const acc = newAccum();
  for (const r of rows) addToAccum(acc, r);
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
  for (const p of points) addToAccum(acc, p);
  return finalizeAccum(acc);
}

/** rows を keyFn の戻り値でグルーピングし、キーごとの Metrics を返す。 */
export function groupByKey<T extends string>(rows: GscApiRow[], keyFn: (r: GscApiRow) => T): Map<T, Metrics> {
  const accs = new Map<T, Accum>();
  for (const r of rows) addToAccum(getOrInsert(accs, keyFn(r), newAccum), r);
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
    const windowPoints = points.slice(Math.max(0, i - (MA_WINDOW_DAYS - 1)), i + 1);
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
    addToAccum(getOrInsert(byType, pageType, newAccum), r);
    getOrInsert(distinctPages, pageType, () => new Set<string>()).add(url);
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
    addToAccum(getOrInsert(byCat, cat, newAccum), r);
    getOrInsert(distinct, cat, () => new Set<string>()).add(q);
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
    getOrInsert(queryCountByPath, r.keys[0], () => new Set<string>()).add(r.keys[1]);
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
      addToAccum(acc, m);
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

// ===== 期間比較（施策の効果検証用） =====

/** 前後2期間の同じ指標を並べ、差分を添えた行。 */
export interface MetricsDiff {
  current: Metrics;
  previous: Metrics;
  clicksDelta: number;
  impressionsDelta: number;
  /** previous.position - current.position。正の値=順位改善（数値が小さくなった）。 */
  positionDelta: number;
  /** current.ctr - previous.ctr（比率のままの差。表示側で % 化する）。 */
  ctrDelta: number;
}

export function diffMetrics(current: Metrics, previous: Metrics): MetricsDiff {
  return {
    current,
    previous,
    clicksDelta: current.clicks - previous.clicks,
    impressionsDelta: current.impressions - previous.impressions,
    // 片方でも露出が無いと順位の差は意味を持たないため0にする（comparePages と同方針）。
    positionDelta:
      previous.impressions > 0 && current.impressions > 0 ? previous.position - current.position : 0,
    ctrDelta: current.ctr - previous.ctr,
  };
}

export interface PageTypeDiff extends MetricsDiff {
  pageType: PageType;
  pageCount: number;
  prevPageCount: number;
}

/** ページタイプ別の前後比較。どちらか一方にしか出てこないタイプも0埋めで並べる。 */
export function comparePageTypes(current: PageTypeAgg[], previous: PageTypeAgg[]): PageTypeDiff[] {
  const prevByType = new Map(previous.map((p) => [p.pageType, p]));
  const types = new Set<PageType>([...current.map((c) => c.pageType), ...previous.map((p) => p.pageType)]);
  const curByType = new Map(current.map((c) => [c.pageType, c]));
  const out: PageTypeDiff[] = [];
  for (const pageType of types) {
    const c = curByType.get(pageType);
    const p = prevByType.get(pageType);
    out.push({
      pageType,
      pageCount: c?.pageCount ?? 0,
      prevPageCount: p?.pageCount ?? 0,
      ...diffMetrics(c ?? EMPTY_METRICS, p ?? EMPTY_METRICS),
    });
  }
  return out.sort((a, b) => b.current.clicks - a.current.clicks);
}

/** 露出率（Exposure Rate）の推移。 */
export interface CoverageDiff {
  total: number;
  exposed: number;
  prevExposed: number;
  exposureRate: number;
  prevExposureRate: number;
  /** exposureRate - prevExposureRate（比率のままの差） */
  rateDelta: number;
}

export function diffCoverage(current: MuniCoverage, previous: MuniCoverage): CoverageDiff {
  return {
    total: current.total,
    exposed: current.exposed,
    prevExposed: previous.exposed,
    exposureRate: current.exposureRate,
    prevExposureRate: previous.exposureRate,
    rateDelta: current.exposureRate - previous.exposureRate,
  };
}

/** 施策対象URLセットの集計結果。 */
export interface UrlSetAgg extends MetricsDiff {
  name: string;
  pr?: number;
  note?: string;
  /** セットに一致し、かつ当期に露出のあったURL数 */
  matchedPages: number;
  prevMatchedPages: number;
}

/**
 * URL セットごとに、一致するページの指標を合算して前後比較する。
 * 「PR #129 で触ったページ群は全体としてどう動いたか」を1行で見るためのもの。
 */
export function aggregateUrlSets(
  sets: { name: string; pr?: number; note?: string; matches: (path: string) => boolean }[],
  current: Map<string, Metrics>,
  previous: Map<string, Metrics>,
): UrlSetAgg[] {
  return sets.map((set) => {
    const sum = (m: Map<string, Metrics>) => {
      const acc = newAccum();
      let pages = 0;
      for (const [path, metrics] of m) {
        if (!set.matches(path)) continue;
        addToAccum(acc, metrics);
        if (metrics.impressions > 0) pages++;
      }
      return { metrics: finalizeAccum(acc), pages };
    };
    const c = sum(current);
    const p = sum(previous);
    return {
      name: set.name,
      pr: set.pr,
      note: set.note,
      matchedPages: c.pages,
      prevMatchedPages: p.pages,
      ...diffMetrics(c.metrics, p.metrics),
    };
  });
}
