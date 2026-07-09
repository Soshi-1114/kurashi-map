// ピラーページ /map/land-price。「地価 マップ」「土地 安い 地域 地図」の検索意図を
// 獲得するハブ（構成は /map/foreign-ratio と共通テンプレート）。

import type { Metadata } from "next";
import ReactDOM from "react-dom";
import HomeShell from "@/components/HomeShell";
import { MetricMapHubBody, hubMetadata, hubLdJson, type MetricHubConfig } from "@/components/MetricMapHub";
import { listSummaryAcrossPrefs, listAllAcrossPrefs } from "@/lib/metrics";
import { getRankingBySlug, rankBy, muniLevelOnly, formatAsOfJa } from "@/lib/rankings";
import { PREFS } from "@/lib/prefs";
import { SITE, absoluteUrl } from "@/lib/site";

const PATH = "/map/land-price";
const HIGH = getRankingBySlug("land-price-high")!;
const LOW = getRankingBySlug("land-price-low")!;

async function loadConfig(): Promise<MetricHubConfig> {
  const all = muniLevelOnly(await listAllAcrossPrefs());
  const high = rankBy(HIGH, all, 12);
  const low = rankBy(LOW, all, 8);
  const asOfJa = formatAsOfJa(high[0]?.landPrice.asOf ?? "");
  const priceText = (v: number) => `${v.toLocaleString()}円/㎡`;
  return {
    path: PATH,
    title: `地価マップ｜市区町村の住宅地の地価を地図で見る【${asOfJa || "最新"}】 - ${SITE.name}`,
    description: `全国の市区町村の住宅地の地価（地価公示・円/㎡）を色分けした地図（コロプレス）。地価が高い地域・安い地域をひと目で比較できます。都道府県別・ランキングへも展開。出典: 国土交通省 地価公示${asOfJa ? `（${asOfJa}）` : ""}。`,
    ogImage: absoluteUrl("/api/og/ranking/land-price-high"),
    ogAlt: "地価マップ",
    h1: "住宅地の地価を地図で見る",
    leads: [
      "全国の市区町村の住宅地の地価（地価公示の住宅地平均・円/㎡）を、色の濃淡で表したコロプレスマップです。都心からの距離や沿線で地価がどう変わるかをひと目で比較できます。地図の自治体をクリックすると、その街の地価・家賃・人口推移・災害リスクなどの住環境データを確認できます。",
      `数値は国土交通省「地価公示」${asOfJa ? `（${asOfJa}）` : ""}の実データ（住宅地の平均）で、推計値は含みません。標準地が無い自治体は「対象外」として灰色で表示します。`,
    ],
    nextUpdate: HIGH.nextUpdate,
    rankingLinks: [
      { href: "/ranking/land-price-high", label: "地価が高い市区町村ランキング" },
      { href: "/ranking/land-price-low", label: "地価が安い市区町村ランキング" },
    ],
    sections: [
      { heading: "地価が高い市区町村", entries: high.map((m) => ({ m, valueText: priceText(m.landPrice.value) })) },
      { heading: "地価が安い市区町村", entries: low.map((m) => ({ m, valueText: priceText(m.landPrice.value) })) },
    ],
    prefsWithData: PREFS.filter((p) => all.some((m) => m.pref === p.slug && HIGH.qualifies(m))),
    prefHref: (slug) => `/ranking/land-price-high/${slug}`,
    foot: "© KurashiMap — 出典: 国土交通省 地価公示（国土数値情報 L01）。住宅地の平均地価を市区町村単位で比較しています。",
    dataset: {
      name: "市区町村別 住宅地地価（地価公示）コロプレスマップ",
      description: "国土交通省 地価公示に基づく市区町村別の住宅地平均地価（円/㎡）のデータセット。地図上で色分け（コロプレス）して比較できる。推計値は含まない。",
      keywords: ["地価", "地価公示", "住宅地", "地図", "マップ", "コロプレス", "市区町村", "土地"],
      temporalCoverage: high[0]?.landPrice.asOf,
    },
  };
}

export async function generateMetadata(): Promise<Metadata> {
  return hubMetadata(await loadConfig());
}

export default async function LandPriceMapPage() {
  ReactDOM.preconnect("https://tiles.openfreemap.org", { crossOrigin: "anonymous" });
  const summary = await listSummaryAcrossPrefs();
  const cfg = await loadConfig();
  return (
    <main className="home-main">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(hubLdJson(cfg)) }} />
      <HomeShell summary={summary} initialMetric="landPrice" navLabel="地価の地図から探す">
        <MetricMapHubBody {...cfg} />
      </HomeShell>
    </main>
  );
}
