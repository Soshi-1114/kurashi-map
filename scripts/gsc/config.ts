// GSC 分析ツールの閾値・分類ルール。数値やパターンを変えたい時はここだけ触ればよい
// （集計・抽出ロジック本体（aggregate.ts / opportunities.ts）は変更不要な設計）。

import type { QueryCategory } from "./types";

export const GSC_SITE_URL = process.env.GSC_SITE_URL || "sc-domain:kurashimap.jp";

// GSC はデータ確定までに遅延があるため、直近 END_DATE_LAG_DAYS 日は集計対象から外す
// （"今日"を終端にすると直近日が未確定データで欠けて見える）。
export const END_DATE_LAG_DAYS = 3;

export const DEFAULT_DAYS = 28;
export const ALLOWED_QUICK_DAYS = [7, 28, 90] as const;

// 日別サイトトレンドの移動平均日数（summary.md「直近N日」節・daily.csv の *MA7 列）。
export const MA_WINDOW_DAYS = 7;

// Opportunity 抽出の閾値。仕様書の条件をそのまま定数化。
export const OPPORTUNITY_THRESHOLDS = {
  highImpressionLowCtr: { minImpressions: 100, maxPosition: 10, maxCtr: 0.03 },
  page2: { minPosition: 8, maxPosition: 20, minImpressions: 50, priorityMin: 11, priorityMax: 15 },
  nearTop: { minPosition: 4, maxPosition: 10, minImpressions: 50 },
  zeroClickHighImpression: { minImpressions: 50 },
  // 順位比較は「一定以上の impressions」がないとノイズが大きいので下限を設ける。
  positionChange: { minDelta: 3, minImpressions: 20 },
  newVisibility: { minImpressions: 1 },
} as const;

// 自治体ページのステータス分類閾値。判定は aggregate.ts の classifyMuniStatus が
// 上から順に評価する優先順位（No Impression → Weak → Opportunity → Low CTR → Growing → Strong）。
export const MUNI_STATUS_THRESHOLDS = {
  weakMaxImpressions: 5,
  opportunityMinPosition: 11,
  opportunityMaxPosition: 20,
  lowCtrMaxPosition: 10,
  lowCtrMaxCtr: 0.02,
  lowCtrMinImpressions: 20,
  growingMinClicksDeltaPct: 0.2,
  growingMinPositionImprove: 2,
  strongMinClicks: 5,
} as const;

// クエリの自治体名マッチング対象とする最小文字数（1文字の自治体名は誤判定が多いため除外）。
export const MIN_MUNI_NAME_MATCH_LENGTH = 2;

// クエリ分類（config.ts で追加・変更しやすいよう、単純な正規表現のマップに集約）。
// 判定順序: branded → municipality（自治体マスタと突合） → 以下のテーマ別パターン → other。
export const QUERY_CATEGORY_PATTERNS: Partial<Record<QueryCategory, RegExp>> = {
  branded: /(くらしまっぷ|くらしマップ|kurashi\s*-?\s*map|kurashimap)/i,
  livability: /(住みやす|住み心地|暮らしやす)/,
  safety: /(治安|犯罪)/,
  child: /(子育て|待機児童|保育園|幼稚園園?児|小学校|中学校)/,
  money: /(家賃|物価|所得|年収|地価)/,
  disaster: /(災害|地震|洪水|ハザード|浸水|津波|土砂)/,
  population: /(人口)/,
  medical: /(病院|医療)/,
};

// summary.md / analysis.json に含める上位件数の上限（巨大化防止）。
export const REPORT_TOP_N = {
  winners: 50,
  losers: 50,
  newVisibility: 50,
  lowCtr: 50,
  page2: 50,
  noImpressionPages: 100,
  // summary.md の各表に実際に表示する行数（CSV/analysis.json は上記の上限まで含む）。
  summaryDisplay: 30,
};

export const REPORT_OUT_DIR = "reports/gsc";

// 施策対象URLセットの定義ファイル（リポジトリルートからの相対パス）。
// reports/ は .gitignore 済みで新規クローンに存在しないため、施策と同じPRでコミットできる
// docs/seo/ に置く。書式は scripts/gsc/urlSets.ts の UrlSet 型を参照。
export const URL_SETS_PATH = "docs/seo/url-sets.json";
