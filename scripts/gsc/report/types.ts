// analyze.ts が組み立て、summary.md / analysis.json / analysis-prompt.md の
// 3つのレポートジェネレータへ渡す集計結果一式。

import type {
  CoverageDiff,
  DailyPoint,
  MuniAgg,
  MuniCoverage,
  PageTypeAgg,
  PageTypeDiff,
  PrefAgg,
  QueryCategoryAgg,
  UrlSetAgg,
} from "../aggregate";
import type { OpportunityRow, PeriodDiffRow } from "../opportunities";
import type { ComparedMode } from "../periods";
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
  mode: ComparedMode;
  period: PeriodRange;
  site: Metrics;
  pageDiffs: PeriodDiffRow[];
  winners: PeriodDiffRow[];
  losers: PeriodDiffRow[];
  positionImprove: PeriodDiffRow[];
  positionDecline: PeriodDiffRow[];
  newVisibility: PeriodDiffRow[];
  /** ページタイプ別の前後比較 */
  pageTypes: PageTypeDiff[];
  /** 自治体ページの露出率（Exposure Rate）の推移 */
  coverage: CoverageDiff;
  /** 施策対象URLセットごとの前後比較（docs/seo/url-sets.json 由来。未定義なら空） */
  urlSets: UrlSetAgg[];
  /** 期間の取り方に関する注意書き（日数が揃わない場合など） */
  warning?: string;
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
