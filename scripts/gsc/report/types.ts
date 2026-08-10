// analyze.ts が組み立て、summary.md / analysis.json / analysis-prompt.md の
// 3つのレポートジェネレータへ渡す集計結果一式。

import type { DailyPoint, MuniAgg, MuniCoverage, PageTypeAgg, PrefAgg, QueryCategoryAgg } from "../aggregate";
import type { OpportunityRow, PeriodDiffRow } from "../opportunities";
import type { Metrics, PeriodRange, QueryCategory, UrlMeta } from "../types";

export interface PageRow extends Metrics {
  url: string;
  meta: UrlMeta;
}

export interface QueryRow extends Metrics {
  query: string;
  category: QueryCategory;
}

export interface PageQueryRow extends Metrics {
  url: string;
  meta: UrlMeta;
  query: string;
  category: QueryCategory;
}

export interface CompareBundle {
  mode: "adjacent" | "yoy";
  period: PeriodRange;
  site: Metrics;
  pageDiffs: PeriodDiffRow[];
  winners: PeriodDiffRow[];
  losers: PeriodDiffRow[];
  positionImprove: PeriodDiffRow[];
  positionDecline: PeriodDiffRow[];
  newVisibility: PeriodDiffRow[];
}

export interface FixedWindowComparison {
  label: string; // "直近7日" 等
  current: Metrics;
  previous: Metrics;
  currentRange: PeriodRange;
  previousRange: PeriodRange;
}

export interface ReportBundle {
  generatedAt: string; // ISO
  siteUrl: string;
  searchType: string;
  current: PeriodRange;
  compare: CompareBundle | null;
  daily: DailyPoint[];
  dailyRange: PeriodRange;
  fixedWindows: { last7: FixedWindowComparison; last28: FixedWindowComparison };
  site: Metrics;
  pages: PageRow[];
  queries: QueryRow[];
  pageQueries: PageQueryRow[];
  pageTypes: PageTypeAgg[];
  queryCategories: QueryCategoryAgg[];
  municipalities: MuniAgg[];
  muniCoverage: MuniCoverage;
  prefectures: PrefAgg[];
  devices: Map<string, Metrics>;
  countries: Map<string, Metrics>;
  opportunities: {
    highImpressionLowCtr: OpportunityRow[];
    page2: OpportunityRow[];
    nearTop: OpportunityRow[];
    zeroClickHighImpression: OpportunityRow[];
  };
  noImpressionMunicipalities: MuniAgg[];
  /** ページ数・クエリ数など、GSC 上限やサンプリングにより件数保証できない旨の注記。 */
  dataNotes: string[];
}
