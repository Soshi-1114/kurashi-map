// ピラーページ /map/population-trend。「人口減少 地図」「人口 増えている 街」の
// 検索意図を獲得するハブ（構成は /map/foreign-ratio と共通テンプレート）。

import type { Metadata } from "next";
import ReactDOM from "react-dom";
import HomeShell from "@/components/HomeShell";
import { MetricMapHubBody, hubMetadata, hubLdJson, type MetricHubConfig } from "@/components/MetricMapHub";
import { listSummaryAcrossPrefs, listAllAcrossPrefs } from "@/lib/metrics";
import { getRankingBySlug, rankBy, muniLevelOnly } from "@/lib/rankings";
import { PREFS } from "@/lib/prefs";
import { SITE, absoluteUrl } from "@/lib/site";

const PATH = "/map/population-trend";
const GROWTH = getRankingBySlug("population-growth")!;

async function loadConfig(): Promise<MetricHubConfig> {
  const all = muniLevelOnly(await listAllAcrossPrefs());
  const growth = rankBy(GROWTH, all, 12);
  // 減少側 = 増減率の昇順（GROWTH と同じ対象条件で並びだけ反転）。
  const decline = all
    .filter(GROWTH.qualifies)
    .sort((a, b) => (a.populationChangeRate ?? 0) - (b.populationChangeRate ?? 0))
    .slice(0, 8);
  const rateText = (m: (typeof all)[number]) => GROWTH.display(m);
  return {
    path: PATH,
    title: `人口増減マップ｜人口が増えている街・減っている街を地図で見る【2025年国勢調査】 - ${SITE.name}`,
    description: `全国1,918市区町村の5年間（2020→2025年国勢調査）の人口増減を色分けした地図。人口が増えている街・減っている街をひと目で比較できます。増加率ランキングへも展開。出典: 総務省 国勢調査。`,
    ogImage: absoluteUrl("/api/og/ranking/population-growth"),
    ogAlt: "人口増減マップ",
    h1: "人口増減を地図で見る",
    leads: [
      "全国1,918市区町村の人口増減（2020年→2025年国勢調査の5年間トレンド）を、増加〜減少の5段階で色分けしたマップです。人口が増えている街・減っている街の分布をひと目で確認できます。地図の自治体をクリックすると、その街の人口・家賃・地価・子育てなどの住環境データを確認できます。",
      "数値は総務省「国勢調査」（2025年速報集計）の実データで、推計値は含みません。人口増減は街の活力や将来の生活利便性を読み解く手がかりのひとつです。",
    ],
    nextUpdate: GROWTH.nextUpdate,
    rankingLinks: [
      { href: "/ranking/population-growth", label: "人口増加率が高い市区町村ランキング" },
      { href: "/ranking/population-most", label: "人口が多い市区町村ランキング" },
    ],
    sections: [
      { heading: "人口増加率が高い市区町村", entries: growth.map((m) => ({ m, valueText: rateText(m) })) },
      { heading: "人口減少率が大きい市区町村", entries: decline.map((m) => ({ m, valueText: rateText(m) })) },
    ],
    prefsWithData: PREFS.filter((p) => all.some((m) => m.pref === p.slug && GROWTH.qualifies(m))),
    prefHref: (slug) => `/ranking/population-growth/${slug}`,
    foot: "© KurashiMap — 出典: 総務省 国勢調査（e-Stat）。2020年→2025年の人口増減率を市区町村単位で比較しています。",
    dataset: {
      name: "市区町村別 人口増減（2020→2025年国勢調査）マップ",
      description: "総務省 国勢調査に基づく全国1,918市区町村の5年間人口増減率（%）のデータセット。地図上で増加〜減少の5段階に色分けして比較できる。推計値は含まない。",
      keywords: ["人口", "人口増減", "人口減少", "人口増加率", "地図", "マップ", "市区町村", "国勢調査"],
      temporalCoverage: "2020/2025",
    },
  };
}

export async function generateMetadata(): Promise<Metadata> {
  return hubMetadata(await loadConfig());
}

export default async function PopulationTrendMapPage() {
  ReactDOM.preconnect("https://tiles.openfreemap.org", { crossOrigin: "anonymous" });
  const summary = await listSummaryAcrossPrefs();
  const cfg = await loadConfig();
  return (
    <main className="home-main">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(hubLdJson(cfg)) }} />
      <HomeShell summary={summary} initialMetric="populationTrend" navLabel="人口増減の地図から探す">
        <MetricMapHubBody {...cfg} />
      </HomeShell>
    </main>
  );
}
