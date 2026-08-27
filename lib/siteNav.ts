// 指標別 地図ハブ（/map/*）の一覧。SiteFooter・HomeLinks・app/sitemap.ts が参照する
// 単一ソース（従来は3箇所に path+ラベルが直書きされ、future-population の導線が
// トップから漏れる実害が出ていた）。ハブを増減する時はここだけ変更する。
// lib/mapMetrics.ts に足さないのは、あちらが MapLibre の色式を持つ地図レイヤ層で、
// 全ページのフッターから import するとサーバーモジュールグラフに重い定義を引き込むため。
export type NavLink = { href: string; label: string };

export const MAP_HUBS: ReadonlyArray<NavLink & { sitemapPriority: number }> = [
  { href: "/map/rent", label: "家賃相場マップ", sitemapPriority: 0.8 },
  { href: "/map/land-price", label: "地価マップ", sitemapPriority: 0.8 },
  { href: "/map/population-trend", label: "人口増減マップ", sitemapPriority: 0.8 },
  { href: "/map/future-population", label: "将来人口マップ（2050年推計）", sitemapPriority: 0.8 },
  // 「外国人 割合 地図」系の主力クエリの入口なので priority だけ高い
  { href: "/map/foreign-ratio", label: "外国人住民の割合マップ", sitemapPriority: 0.9 },
];

// ランキング slug → 対応する地図ハブ。ランキングページ（全国・県別）の「地図で見る」
// CTA が参照する。対応ハブが無い指標（population-most・vacancy 等）はここに載せず、
// CTA 自体を出さない。ラベル・href は MAP_HUBS を単一ソースとして引く。
const RANKING_TO_HUB: Readonly<Record<string, string>> = {
  "rent-cheap": "/map/rent",
  "rent-high": "/map/rent",
  "land-price-high": "/map/land-price",
  "land-price-low": "/map/land-price",
  "population-growth": "/map/population-trend",
  "population-decline": "/map/population-trend",
  "future-population-decline": "/map/future-population",
  "future-population-resilient": "/map/future-population",
  "foreign-ratio-high": "/map/foreign-ratio",
  "foreign-ratio-low": "/map/foreign-ratio",
};

/** ランキング slug に対応する地図ハブ（無い指標は null）。 */
export function mapHubForRanking(slug: string): NavLink | null {
  const href = RANKING_TO_HUB[slug];
  return MAP_HUBS.find((h) => h.href === href) ?? null;
}
