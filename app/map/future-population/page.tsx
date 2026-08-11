// ピラーページ /map/future-population。「2050年 人口予測 マップ」「将来人口 市区町村」の
// 検索意図を獲得するハブ。全国コロプレスを初期表示し、将来推計人口ランキング・県別・
// 自治体ページへ放射状に内部リンクする（構成は /map/rent と共通テンプレート）。
//
// 表現の制約: 「消滅可能性」等の煽り表現は使わず、「将来推計人口」「減少率（推計）」の
// 中立表現に統一する。公的推計であり予測の保証ではない旨を必ず添える。

import type { Metadata } from "next";
import ReactDOM from "react-dom";
import HomeShell from "@/components/HomeShell";
import { MetricMapHubBody, hubMetadata, hubLdJson, type MetricHubConfig } from "@/components/MetricMapHub";
import { listSummaryAcrossPrefs, listAllAcrossPrefs } from "@/lib/metrics";
import { getRankingBySlug, rankBy, muniLevelOnly } from "@/lib/rankings";
import { futureChangeRate2050 } from "@/lib/futurePopulation";
import { PREFS } from "@/lib/prefs";
import { SITE, absoluteUrl } from "@/lib/site";

const PATH = "/map/future-population";
const DECLINE = getRankingBySlug("future-population-decline")!;
const RESILIENT = getRankingBySlug("future-population-resilient")!;

async function loadConfig(): Promise<MetricHubConfig> {
  const all = muniLevelOnly(await listAllAcrossPrefs());
  const resilient = rankBy(RESILIENT, all, 12);
  const decline = rankBy(DECLINE, all, 8);
  const rateText = (m: (typeof all)[number]) => {
    const r = futureChangeRate2050(m.futurePopulation);
    return r == null ? "—" : `${r > 0 ? "+" : ""}${r.toFixed(1)}%`;
  };
  return {
    path: PATH,
    title: `2050年将来推計人口マップ｜市区町村の人口増減の見込みを地図で見る - ${SITE.name}`,
    description:
      "全国の市区町村・行政区の2050年将来推計人口の増減率（2020年比）を色分けした地図（コロプレス）。人口を維持する見込みの地域・減少が見込まれる地域をひと目で比較できます。出典: 国立社会保障・人口問題研究所（令和5(2023)年推計）。公的推計であり将来を保証するものではありません。",
    ogImage: absoluteUrl("/api/og/ranking/future-population-decline"),
    ogAlt: "2050年将来推計人口マップ",
    h1: "2050年の将来推計人口を地図で見る",
    leads: [
      "全国の市区町村・行政区について、2050年の将来推計人口が2020年比でどれだけ増減する見込みかを、色の濃淡で表したコロプレスマップです（紫=減少、緑=増加）。地図の自治体をクリックすると、現在の人口・家賃・子育て・災害リスクなどの住環境データとあわせて確認できます。",
      "数値は国立社会保障・人口問題研究所（IPSS）「日本の地域別将来推計人口」（令和5(2023)年推計・2020年国勢調査基準）の公表値をそのまま用いており、独自の推計・補間はしていません。一定の仮定に基づく公的推計であり、将来の人口を保証するものではありません。福島県浜通りの13市町村（一括推計）・北方領土などは市区町村別の推計がないため「データなし」として灰色で表示します。",
    ],
    nextUpdate: DECLINE.nextUpdate,
    rankingLinks: [
      { href: "/ranking/future-population-resilient", label: "2050年推計人口の減少率が小さい市区町村ランキング" },
      { href: "/ranking/future-population-decline", label: "2050年推計人口の減少率が大きい市区町村ランキング" },
    ],
    sections: [
      {
        heading: "2050年も人口を維持する見込みの市区町村（推計）",
        entries: resilient.map((m) => ({ m, valueText: rateText(m) })),
      },
      {
        heading: "2050年の人口減少率が大きい市区町村（推計）",
        entries: decline.map((m) => ({ m, valueText: rateText(m) })),
      },
    ],
    prefsWithData: PREFS.filter((p) => all.some((m) => m.pref === p.slug && DECLINE.qualifies(m))),
    prefHref: (slug) => `/ranking/future-population-decline/${slug}`,
    foot: "© KurashiMap — 出典: 国立社会保障・人口問題研究所「日本の地域別将来推計人口」（令和5(2023)年推計）。公表値を市区町村単位で比較しています（独自推計はしません）。",
    dataset: {
      name: "市区町村別 2050年将来推計人口（増減率）コロプレスマップ",
      description:
        "国立社会保障・人口問題研究所「日本の地域別将来推計人口」（令和5(2023)年推計）に基づく全国の市区町村・行政区の2050年推計人口と2020年比増減率のデータセット。地図上で色分け（コロプレス）して比較できる。公的推計の公表値のみで独自推計は含まない。",
      keywords: ["将来推計人口", "2050年", "人口予測", "人口減少", "地図", "マップ", "コロプレス", "市区町村"],
      temporalCoverage: "2020/2050",
    },
  };
}

export async function generateMetadata(): Promise<Metadata> {
  return hubMetadata(await loadConfig());
}

export default async function FuturePopulationMapPage() {
  ReactDOM.preconnect("https://tiles.openfreemap.org", { crossOrigin: "anonymous" });
  const summary = await listSummaryAcrossPrefs();
  const cfg = await loadConfig();
  return (
    <main className="home-main">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(hubLdJson(cfg)) }} />
      <HomeShell summary={summary} initialMetric="futurePopulation" navLabel="2050年推計人口の地図から探す">
        <MetricMapHubBody {...cfg} />
      </HomeShell>
    </main>
  );
}
