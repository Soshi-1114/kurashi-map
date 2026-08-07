import "./compare.css";
import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { listSummaryAcrossPrefs, listAllAcrossPrefs } from "@/lib/metrics";
import { muniLevelOnly } from "@/lib/rankings";
import { SITE, absoluteUrl } from "@/lib/site";
import { getAreaStats } from "@/lib/areaStats";
import { getForeignStats, nationalForeignAvg } from "@/lib/foreignStats";
import type { NationalAverages } from "@/lib/compareMetrics";
import CompareClient, { MAX_COMPARE } from "@/components/compare/CompareClient";

// 自治体比較ページ。骨格（説明・プリセット・パンくず）は SSG の静的HTML、
// 選択状態は ?codes= のクエリとしてクライアント側で扱う（組合せの静的生成はしない）。
// canonical は常に /compare（クエリ付きビューは同一ページの状態）。

const TITLE = `自治体を比較｜家賃・人口・災害リスクを横並びで確認 - ${SITE.name}`;
const DESC =
  `全国1,918市区町村から最大${MAX_COMPARE}つを選んで、人口・人口増減率・家賃相場・地価・空き家率・待機児童・生活インフラ・災害リスクを横並びで比較できます。政府統計の実データのみ使用し、推計値は使いません。`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: "/compare" },
  openGraph: {
    type: "website",
    url: absoluteUrl("/compare"),
    siteName: SITE.name,
    title: TITLE,
    description: DESC,
    images: [{ url: absoluteUrl("/api/og"), width: 1200, height: 630, alt: SITE.name }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC, images: [absoluteUrl("/api/og")] },
};

// プリセット（人口上位の市区町村から決定論的にペアを作る。架空のおすすめは作らない）。
async function getPresetPairs() {
  const munis = muniLevelOnly(await listAllAcrossPrefs())
    .slice()
    .sort((a, b) => b.population - a.population)
    .slice(0, 6);
  const pairs: Array<{ label: string; codes: string }> = [];
  for (let i = 0; i + 1 < munis.length; i += 2) {
    const [a, b] = [munis[i], munis[i + 1]];
    pairs.push({ label: `${a.name} × ${b.name}`, codes: `${a.code},${b.code}` });
  }
  return pairs;
}

export default async function ComparePage() {
  const summary = await listSummaryAcrossPrefs();
  const presets = await getPresetPairs();

  // 全国平均（参考）列。areaStats/foreignStats はサーバー専用の集計レイヤーなので
  // ここで値だけを取り出し、静的な props としてクライアントコンポーネントへ渡す
  // （集計ロジックそのものはクライアントに持ち込まない）。
  const areaStats = await getAreaStats();
  const foreignStats = await getForeignStats();
  const nationalAverages: NationalAverages = {
    rent: areaStats.rent.national,
    landPrice: areaStats.landPrice.national,
    populationChangeRate: areaStats.populationChangeRate.national,
    vacancyRate: areaStats.vacancyRate.national,
    density: areaStats.density.national,
    foreignRatio: nationalForeignAvg(foreignStats),
  };

  const ldJson = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: SITE.name, item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: "自治体を比較", item: absoluteUrl("/compare") },
        ],
      },
    ],
  };

  return (
    <div className="cmp-root">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldJson) }} />
      <nav aria-label="パンくず" className="breadcrumb">
        <Link href="/" className="breadcrumb-link">{SITE.name}</Link>
        <span aria-hidden="true">/</span>
        <span className="breadcrumb-current">自治体を比較</span>
      </nav>

      <header className="cmp-hero">
        <h1 className="cmp-title">自治体を比較する</h1>
        <p className="cmp-lead">
          気になる市区町村を最大{MAX_COMPARE}つ選ぶと、人口・住まい・子育て・生活インフラ・災害リスクの主要指標を横並びで確認できます。数値はすべて政府統計・国土数値情報の実データで、データのない項目は「データなし／対象外」と表示します。
        </p>
      </header>

      <Suspense fallback={<p className="cmp-empty">読み込み中…</p>}>
        <CompareClient munis={summary} nationalAverages={nationalAverages} />
      </Suspense>

      <section>
        <h2 className="home-links-h" style={{ marginTop: 28 }}>比較の例</h2>
        <ul className="cmp-presets">
          {presets.map((p) => (
            <li key={p.codes}>
              <Link href={`/compare?codes=${p.codes}`} className="home-chip">{p.label}</Link>
            </li>
          ))}
        </ul>
      </section>

      <p className="cmp-note">
        出典: e-Stat（住宅・土地統計調査／国勢調査）・地価公示／地価調査・こども家庭庁・出入国在留管理庁・国土数値情報・国土地理院。指標の基準時点と更新方針は
        <Link href="/about">「このサイトについて」</Link>
        を参照してください。各自治体の詳しいデータは表の自治体名から個別ページで確認できます。「全国平均（参考）」は自治体を1票とする単純平均です（外国人住民比率のみ人口加重平均）。
      </p>
    </div>
  );
}
