// ピラーページ /map/rent。「家賃相場 地図」「家賃 安い 地域 マップ」の検索意図を
// 獲得するハブ。全国コロプレスを初期表示し、家賃ランキング・県別・自治体ページへ
// 放射状に内部リンクする（構成は /map/foreign-ratio と共通テンプレート）。

import type { Metadata } from "next";
import ReactDOM from "react-dom";
import HomeShell from "@/components/HomeShell";
import { MetricMapHubBody, hubMetadata, hubLdJson, type MetricHubConfig } from "@/components/MetricMapHub";
import { listSummaryAcrossPrefs, listAllAcrossPrefs } from "@/lib/metrics";
import { getRankingBySlug, rankBy, muniLevelOnly, formatAsOfJa } from "@/lib/rankings";
import { PREFS } from "@/lib/prefs";
import { SITE, absoluteUrl } from "@/lib/site";

const PATH = "/map/rent";
const CHEAP = getRankingBySlug("rent-cheap")!;
const HIGH = getRankingBySlug("rent-high")!;

async function loadConfig(): Promise<MetricHubConfig> {
  const all = muniLevelOnly(await listAllAcrossPrefs());
  const cheap = rankBy(CHEAP, all, 12);
  const high = rankBy(HIGH, all, 8);
  const asOfJa = formatAsOfJa(cheap[0]?.rent.asOf ?? "");
  const rentText = (v: number) => `${v.toLocaleString()}円/月`;
  return {
    path: PATH,
    title: `家賃相場マップ｜市区町村の家賃が安い地域を地図で見る - ${SITE.name}`,
    description: `全国1,918市区町村の家賃相場（民営借家の中央値）を色分けした地図（コロプレス）。家賃が安い地域・高い地域をひと目で比較できます。都道府県別・ランキングへも展開。出典: 総務省 住宅・土地統計調査${asOfJa ? `（${asOfJa}）` : ""}。`,
    ogImage: absoluteUrl("/api/og/ranking/rent-cheap"),
    ogAlt: "家賃相場マップ",
    h1: "家賃相場を地図で見る",
    leads: [
      "全国1,918市区町村の家賃相場（民営借家の家賃中央値・円/月）を、色の濃淡で表したコロプレスマップです。色をたどるだけで、家賃が安い地域・高い地域の分布をひと目で比較できます。地図の自治体をクリックすると、その街の家賃・地価・人口推移・子育て・災害リスクなどの住環境データを確認できます。",
      `数値は総務省「住宅・土地統計調査」${asOfJa ? `（${asOfJa}）` : ""}の実データ（民営借家の中央値）で、推計値は含みません。住宅統計の集計対象外の小規模町村は「データなし」として灰色で表示します。`,
    ],
    nextUpdate: CHEAP.nextUpdate,
    rankingLinks: [
      { href: "/ranking/rent-cheap", label: "家賃が安い市区町村ランキング" },
      { href: "/ranking/rent-high", label: "家賃が高い市区町村ランキング" },
    ],
    sections: [
      { heading: "家賃が安い市区町村", entries: cheap.map((m) => ({ m, valueText: rentText(m.rent.value) })) },
      { heading: "家賃が高い市区町村", entries: high.map((m) => ({ m, valueText: rentText(m.rent.value) })) },
    ],
    prefsWithData: PREFS.filter((p) => all.some((m) => m.pref === p.slug && CHEAP.qualifies(m))),
    prefHref: (slug) => `/ranking/rent-cheap/${slug}`,
    foot: "© KurashiMap — 出典: 総務省 住宅・土地統計調査（e-Stat）。民営借家の家賃中央値を市区町村単位で比較しています。",
    dataset: {
      name: "市区町村別 家賃相場（民営借家中央値）コロプレスマップ",
      description: "総務省 住宅・土地統計調査に基づく全国1,918市区町村の民営借家家賃中央値（円/月）のデータセット。地図上で色分け（コロプレス）して比較できる。推計値は含まない。",
      keywords: ["家賃", "家賃相場", "安い", "地図", "マップ", "コロプレス", "市区町村", "民営借家"],
      temporalCoverage: cheap[0]?.rent.asOf,
    },
  };
}

export async function generateMetadata(): Promise<Metadata> {
  return hubMetadata(await loadConfig());
}

export default async function RentMapPage() {
  ReactDOM.preconnect("https://tiles.openfreemap.org", { crossOrigin: "anonymous" });
  const summary = await listSummaryAcrossPrefs();
  const cfg = await loadConfig();
  return (
    <main className="home-main">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(hubLdJson(cfg)) }} />
      <HomeShell summary={summary} initialMetric="rent" navLabel="家賃相場の地図から探す">
        <MetricMapHubBody {...cfg} />
      </HomeShell>
    </main>
  );
}
