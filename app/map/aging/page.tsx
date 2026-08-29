// ピラーページ /map/aging。「高齢化率 マップ」「高齢化率 市町村別」の検索意図を獲得する
// ハブ（2026-07 キーワード調査: サジェスト「高齢化率 ランキング」実在・地図化した競合は
// 表形式サイトのみ）。全国コロプレスを初期表示し、高齢化率ランキング・県別・自治体ページへ
// 放射状に内部リンクする（構成は /map/vacancy と共通テンプレート）。

import type { Metadata } from "next";
import ReactDOM from "react-dom";
import HomeShell from "@/components/HomeShell";
import { MetricMapHubBody, hubMetadata, hubLdJson, type MetricHubConfig } from "@/components/MetricMapHub";
import { listSummaryAcrossPrefs, listAllAcrossPrefs } from "@/lib/metrics";
import { getRankingBySlug, rankBy, muniLevelOnly } from "@/lib/rankings";
import { PREFS } from "@/lib/prefs";
import { SITE, absoluteUrl } from "@/lib/site";

const PATH = "/map/aging";
const HIGH = getRankingBySlug("aging-high")!;
const LOW = getRankingBySlug("aging-low")!;

async function loadConfig(): Promise<MetricHubConfig> {
  const all = muniLevelOnly(await listAllAcrossPrefs());
  const high = rankBy(HIGH, all, 12);
  const low = rankBy(LOW, all, 8);
  // 値の整形はランキング定義に委譲する（/map/vacancy と同じ共通パターン）
  const rateText = (m: (typeof all)[number]) => HIGH.display(m);
  return {
    path: PATH,
    title: `高齢化率マップ｜市区町村別の高齢化率を地図で見る - ${SITE.name}`,
    description:
      "全国の市区町村・行政区の高齢化率（65歳以上人口の割合）を色分けした地図（コロプレス）。高齢化率が高い地域・若い世代が多い地域の分布をひと目で比較できます。都道府県別・ランキングへも展開。出典: 総務省 住民基本台帳に基づく人口・世帯数調査（毎年1月1日時点）。",
    ogImage: absoluteUrl("/api/og/ranking/aging-high"),
    ogAlt: "高齢化率マップ",
    h1: "高齢化率を地図で見る",
    leads: [
      "全国の市区町村・行政区の高齢化率（65歳以上人口 ÷ 総人口）を、色の濃淡で表したコロプレスマップです。色をたどるだけで、高齢化が進む地域・若い世代が多い地域の分布をひと目で比較できます。地図の自治体をクリックすると、その街の人口・家賃・子育て・将来人口などの住環境データを確認できます。",
      "数値は総務省「住民基本台帳に基づく人口、人口動態及び世帯数調査」（毎年1月1日時点・総計＝外国人住民を含む）の公表実数から算出しています。年齢構成は地域の事実を示す中立的な指標であり、住みやすさ等の優劣を意味しません。欠損を推計で補うことはせず、住民登録のない北方領土の6村は「データなし」として灰色で表示します。",
    ],
    nextUpdate: HIGH.nextUpdate,
    rankingLinks: [
      { href: "/ranking/aging-high", label: "高齢化率が高い市区町村ランキング" },
      { href: "/ranking/aging-low", label: "高齢化率が低い市区町村ランキング" },
    ],
    sections: [
      { heading: "高齢化率が高い市区町村", entries: high.map((m) => ({ m, valueText: rateText(m) })) },
      { heading: "高齢化率が低い市区町村", entries: low.map((m) => ({ m, valueText: rateText(m) })) },
    ],
    prefsWithData: PREFS.filter((p) => all.some((m) => m.pref === p.slug && HIGH.qualifies(m))),
    prefHref: (slug) => `/ranking/aging-high/${slug}`,
    foot: "© KurashiMap — 出典: 総務省 住民基本台帳に基づく人口・世帯数調査。高齢化率を市区町村単位で比較しています。",
    dataset: {
      name: "市区町村別 高齢化率コロプレスマップ",
      description:
        "総務省 住民基本台帳に基づく人口・世帯数調査（毎年1月1日時点）に基づく全国の市区町村・行政区の高齢化率（%）のデータセット。地図上で色分け（コロプレス）して比較できる。推計値は含まない。",
      keywords: ["高齢化率", "高齢化", "年齢構成", "地図", "マップ", "コロプレス", "市区町村", "住民基本台帳"],
      temporalCoverage: high[0]?.ageStats?.asOf,
    },
  };
}

export async function generateMetadata(): Promise<Metadata> {
  return hubMetadata(await loadConfig());
}

export default async function AgingMapPage() {
  ReactDOM.preconnect("https://tiles.openfreemap.org", { crossOrigin: "anonymous" });
  const summary = await listSummaryAcrossPrefs();
  const cfg = await loadConfig();
  return (
    <main className="home-main">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(hubLdJson(cfg)) }} />
      <HomeShell summary={summary} initialMetric="aging" navLabel="高齢化率の地図から探す">
        <MetricMapHubBody {...cfg} />
      </HomeShell>
    </main>
  );
}
