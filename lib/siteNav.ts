// 指標別 地図ハブ（/map/*）の一覧。SiteFooter・HomeLinks・app/sitemap.ts が参照する
// 単一ソース（従来は3箇所に path+ラベルが直書きされ、future-population の導線が
// トップから漏れる実害が出ていた）。ハブを増減する時はここだけ変更する。
// lib/mapMetrics.ts に足さないのは、あちらが MapLibre の色式を持つ地図レイヤ層で、
// 全ページのフッターから import するとサーバーモジュールグラフに重い定義を引き込むため。
export type NavLink = { href: string; label: string };

// 汎用の全画面地図（指標切替・災害オーバーレイを備えた地図体験の本体）。
// 「地図で見る」ディープリンクの既定の行き先（lib/mapDeepLink.ts）。指標別ハブと
// 役割が違うため MAP_HUBS には含めず、フッター・sitemap では筆頭に別掲する。
export const GENERAL_MAP: NavLink = { href: "/map", label: "住みやすさマップ（総合）" };

export const MAP_HUBS: ReadonlyArray<NavLink & { sitemapPriority: number }> = [
  { href: "/map/rent", label: "家賃相場マップ", sitemapPriority: 0.8 },
  { href: "/map/land-price", label: "地価マップ", sitemapPriority: 0.8 },
  { href: "/map/population-trend", label: "人口増減マップ", sitemapPriority: 0.8 },
  { href: "/map/future-population", label: "将来人口マップ（2050年推計）", sitemapPriority: 0.8 },
  { href: "/map/vacancy", label: "空き家率マップ", sitemapPriority: 0.8 },
  { href: "/map/aging", label: "高齢化率マップ", sitemapPriority: 0.8 },
  { href: "/map/hazard", label: "ハザードマップ", sitemapPriority: 0.8 },
  // 「外国人 割合 地図」系の主力クエリの入口なので priority だけ高い
  { href: "/map/foreign-ratio", label: "外国人住民の割合マップ", sitemapPriority: 0.9 },
];

/** href から地図ハブを引く（RankingDef.mapHub の解決用。未知・未設定は null）。 */
export function mapHubByHref(href: string | undefined): NavLink | null {
  return MAP_HUBS.find((h) => h.href === href) ?? null;
}

// ---- 道具（比較・診断）への送客 ----
//
// ランキングは検索流入の9割を占める一方、比較・診断といった「道具」のページには
// ほとんど回遊していない（2026-09 実測: /compare 80PV・/shindan 13PV）。
// 送り先URLと `from` の語彙をこの2関数に集約し、各ページで生成しない。
//
// from は着地側（CompareClient / ShindanClient）が GA4 の compare_start /
// tool_entry の source として送る。リンク自体はサーバーコンポーネントのまま
// 置けるよう、どちらも素の文字列を返す。

/**
 * 道具への送客元の語彙。**閉じた union にするのが要点**で、GA4 のディメンション値が
 * ここに列挙したものだけになる（自由文字列だと typo が黙って新しい値になり、
 * さらに `pref_ranking`（県別ランキング）と `prefecture_ranking`（都道府県ランキング）の
 * ような紛らわしい対も型で守れない）。増やすときはここに足す。
 */
export type ToolSource =
  | "ranking" // 全国ランキングのヒーロー
  | "ranking_row" // 全国ランキングの順位表の各行
  | "ranking_top3" // 全国ランキングの「上位3件を比較する」
  | "pref_ranking" // 県別ランキング（/ranking/{指標}/{県}）のヒーロー
  | "pref_ranking_top3" // 同上の「上位3件を比較する」
  | "prefecture_ranking" // 都道府県ランキング（/ranking/{指標}/prefecture）のヒーロー
  | "pref_hub" // 県ハブ（/area/{県}）
  | "home" // トップのヒーローアクション
  | "header" // サイト共通ヘッダー（SiteHeader）
  | "compare" // 比較ページ（道具間の相互導線）
  | "shindan_result"; // 街診断の結果セクション（道具間の相互導線）

export type CompareAttribution = {
  experimentId: "compare-link-2026-09";
  variant: "baseline" | "treatment";
  originPath: "/ranking/population-growth/osaka" | "/ranking/population-growth/fukuoka";
};

/** URLパラメータから、事前定義した比較導線実験の値だけを受け入れる。 */
export function parseCompareAttribution(params: URLSearchParams): CompareAttribution | null {
  if (params.get("experiment_id") !== "compare-link-2026-09") return null;
  const variant = params.get("variant");
  const originPath = params.get("origin_path");
  if ((variant !== "baseline" && variant !== "treatment") ||
      (originPath !== "/ranking/population-growth/osaka" && originPath !== "/ranking/population-growth/fukuoka")) {
    return null;
  }
  return { experimentId: "compare-link-2026-09", variant, originPath };
}

const TOOL_SOURCES: readonly ToolSource[] = [
  "ranking", "ranking_row", "ranking_top3", "pref_ranking", "pref_ranking_top3",
  "prefecture_ranking", "pref_hub", "home", "header", "compare", "shindan_result",
];

/** 外部入力の `from` 値を閉じた語彙に正規化する。不明値は計測から除外する。 */
export function parseToolSource(value: string | null): ToolSource | null {
  return value && TOOL_SOURCES.includes(value as ToolSource) ? (value as ToolSource) : null;
}

/**
 * 比較ページで横並びにできる自治体数の上限。
 * ここに置くのは、上限を知る必要があるのがクライアント（CompareClient のピッカー）
 * だけでなく、送り出す側（ランキングの「上位N件を比較する」）でもあるため。
 * サーバーコンポーネントから "use client" モジュールを参照しないで済ませる。
 */
export const MAX_COMPARE = 3;

/** 比較ページ（/compare）へ送るURL。codes は MAX_COMPARE 件に丸める。 */
export function compareHref(codes: string[], from: ToolSource, attribution?: CompareAttribution): string {
  const capped = codes.slice(0, MAX_COMPARE);
  const base = `/compare?codes=${capped.join(",")}&from=${encodeURIComponent(from)}`;
  if (!attribution) return base;
  const query = new URLSearchParams({
    experiment_id: attribution.experimentId,
    variant: attribution.variant,
    origin_path: attribution.originPath,
  });
  return `${base}&${query.toString()}`;
}

/** 街診断（/shindan）へ送るURL。 */
export function shindanHref(from: ToolSource): string {
  return `/shindan?from=${encodeURIComponent(from)}`;
}

/** 電気代シミュレーター（/denki）へ送るURL。code があれば供給エリアを初期選択する。 */
export function denkiHref(code: string | null, from: ToolSource): string {
  const codeParam = code ? `code=${encodeURIComponent(code)}&` : "";
  return `/denki?${codeParam}from=${encodeURIComponent(from)}`;
}
