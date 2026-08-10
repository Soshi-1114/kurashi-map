// GSC 分析ツール共通の型定義。

export type GscDimension = "date" | "page" | "query" | "device" | "country";

/** Search Analytics API の生の行（type=web, dataState=all）。 */
export interface GscApiRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface PeriodRange {
  /** YYYY-MM-DD */
  startDate: string;
  /** YYYY-MM-DD */
  endDate: string;
  /** レポート表示用ラベル（例: "直近28日"） */
  label: string;
}

/** clicks/impressions から導出した集計指標。ctr・position は都度再計算する（平均のブレを避ける）。 */
export interface Metrics {
  clicks: number;
  impressions: number;
  /** 0-1 の比率（表示は呼び出し側で % 化する） */
  ctr: number;
  /** impressions 加重平均掲載順位 */
  position: number;
}

export type PageType =
  | "top"
  | "prefecture"
  | "municipality"
  | "ranking"
  | "map"
  | "compare"
  | "about"
  | "other";

export interface UrlMeta {
  url: string;
  path: string;
  pageType: PageType;
  prefSlug?: string;
  prefNameJa?: string;
  muniCode?: string;
  muniName?: string;
  rankingSlug?: string;
  mapMetric?: string;
}

export interface MuniMeta {
  code: string;
  prefSlug: string;
  prefNameJa: string;
  name: string;
  displayName: string;
  url: string;
}

export type QueryCategory =
  | "branded"
  | "municipality"
  | "livability"
  | "safety"
  | "child"
  | "money"
  | "disaster"
  | "population"
  | "medical"
  | "other";
