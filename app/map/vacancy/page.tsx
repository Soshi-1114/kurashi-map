// ピラーページ /map/vacancy。「空き家率 市町村別」「空き家率 マップ」の検索意図を
// 獲得するハブ（2026-07 SERP調査: 空き家率×市町村の地図は大手ポータル不在の空白領域）。
// 全国コロプレスを初期表示し、空き家率ランキング・県別・自治体ページへ放射状に
// 内部リンクする（構成は /map/rent と共通テンプレート）。

import type { Metadata } from "next";
import ReactDOM from "react-dom";
import HomeShell from "@/components/HomeShell";
import { MetricMapHubBody, hubMetadata, hubLdJson, type MetricHubConfig } from "@/components/MetricMapHub";
import { listSummaryAcrossPrefs, listAllAcrossPrefs } from "@/lib/metrics";
import { getRankingBySlug, rankBy, muniLevelOnly } from "@/lib/rankings";
import { PREFS } from "@/lib/prefs";
import { SITE, absoluteUrl } from "@/lib/site";

const PATH = "/map/vacancy";
const HIGH = getRankingBySlug("vacancy-high")!;
const LOW = getRankingBySlug("vacancy-low")!;

async function loadConfig(): Promise<MetricHubConfig> {
  const all = muniLevelOnly(await listAllAcrossPrefs());
  const high = rankBy(HIGH, all, 12);
  const low = rankBy(LOW, all, 8);
  // 値の整形はランキング定義に委譲する（/map/future-population と同じ共通パターン）
  const rateText = (m: (typeof all)[number]) => HIGH.display(m);
  return {
    path: PATH,
    title: `空き家率マップ｜市区町村別の空き家率を地図で見る - ${SITE.name}`,
    description:
      "全国の市区町村・行政区の空き家率（空き家数÷住宅総数）を色分けした地図（コロプレス）。空き家が多い地域・少ない地域をひと目で比較できます。都道府県別・ランキングへも展開。出典: 総務省 住宅・土地統計調査（2023年）。",
    ogImage: absoluteUrl("/api/og/ranking/vacancy-high"),
    ogAlt: "空き家率マップ",
    h1: "空き家率を地図で見る",
    leads: [
      "全国の市区町村・行政区の空き家率（空き家数 ÷ 住宅総数）を、色の濃淡で表したコロプレスマップです。2023年の全国の空き家率は13.8%と過去最高で、色をたどるだけで空き家の多い地域・少ない地域の分布をひと目で比較できます。地図の自治体をクリックすると、その街の家賃・地価・人口推移・災害リスクなどの住環境データを確認できます。",
      "数値は総務省「住宅・土地統計調査」（2023年）の公表実数で、二次的住宅（別荘など）・賃貸用・売却用を含む空き家全体の割合です。欠損を推計で補うことはせず、同調査の市区町村集計の対象外となる人口1.5万人未満の町村は「データなし」として灰色で表示します。",
    ],
    nextUpdate: HIGH.nextUpdate,
    rankingLinks: [
      { href: "/ranking/vacancy-high", label: "空き家率が高い市区町村ランキング" },
      { href: "/ranking/vacancy-low", label: "空き家率が低い市区町村ランキング" },
    ],
    sections: [
      { heading: "空き家率が高い市区町村", entries: high.map((m) => ({ m, valueText: rateText(m) })) },
      { heading: "空き家率が低い市区町村", entries: low.map((m) => ({ m, valueText: rateText(m) })) },
    ],
    prefsWithData: PREFS.filter((p) => all.some((m) => m.pref === p.slug && HIGH.qualifies(m))),
    prefHref: (slug) => `/ranking/vacancy-high/${slug}`,
    foot: "© KurashiMap — 出典: 総務省 住宅・土地統計調査（e-Stat）。空き家率を市区町村単位で比較しています。",
    dataset: {
      name: "市区町村別 空き家率コロプレスマップ",
      description:
        "総務省 住宅・土地統計調査（2023年）に基づく全国の市区町村・行政区の空き家率（%）のデータセット。地図上で色分け（コロプレス）して比較できる。推計値は含まない。",
      keywords: ["空き家率", "空き家", "地図", "マップ", "コロプレス", "市区町村", "住宅・土地統計調査"],
      temporalCoverage: high[0]?.vacancy?.asOf,
    },
  };
}

export async function generateMetadata(): Promise<Metadata> {
  return hubMetadata(await loadConfig());
}

export default async function VacancyMapPage() {
  ReactDOM.preconnect("https://tiles.openfreemap.org", { crossOrigin: "anonymous" });
  const summary = await listSummaryAcrossPrefs();
  const cfg = await loadConfig();
  return (
    <main className="home-main">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(hubLdJson(cfg)) }} />
      <HomeShell summary={summary} initialMetric="vacancy" navLabel="空き家率の地図から探す">
        <MetricMapHubBody {...cfg} />
      </HomeShell>
    </main>
  );
}
