// ピラーページ /map/hazard。「ハザードマップ 地図」「洪水 浸水想定 地図」等の検索意図と、
// エリア詳細の災害リスクカードからの「ハザードマップを地図で見る」導線の受け皿。
// 他の /map/* がコロプレス指標のハブなのに対し、ここは災害オーバーレイ（GSI 公式ラスタ）を
// 初期点灯した地図を開く。区域ラスタは HAZARD_ZONE_ZOOM 以上で表示されるため、
// リード文でズーム・検索への誘導を明示する。
//
// honesty: 区域表示は国土地理院ハザードマップポータルの公式タイルそのもの。自治体単位の
// 評価値（詳細ページの災害リスク）は区域内最大区分であることを本文でも明示する。

import Link from "next/link";
import type { Metadata } from "next";
import ReactDOM from "react-dom";
import HomeShell from "@/components/HomeShell";
import PrefRegionLinks from "@/components/PrefRegionLinks";
import { listSummaryAcrossPrefs, listAllAcrossPrefs } from "@/lib/metrics";
import { muniLevelOnly } from "@/lib/rankings";
import { isHazardEvaluated } from "@/lib/coverage";
import { HAZARD_OVERLAYS } from "@/lib/mapHazards";
import { PREFS } from "@/lib/prefs";
import { SITE, prefNameOf, absoluteUrl } from "@/lib/site";
import type { Municipality } from "@/lib/types";

const PATH = "/map/hazard";
const OG = absoluteUrl("/api/og");

const TITLE = `全国ハザードマップ｜洪水・土砂災害・津波・高潮を地図で確認 - ${SITE.name}`;
const DESCRIPTION =
  "全国の洪水浸水想定・土砂災害警戒区域・津波/高潮浸水想定を1つの地図で切り替えて確認できます。国土地理院ハザードマップポータルの公式タイルを表示し、市区町村をクリックすると災害リスク評価と指定緊急避難場所も確認できます。";

// 初期点灯するオーバーレイ。全国どの自治体にもある常設2種（洪水・土砂）。
// 津波・高潮は地図のレイヤ切替から選べる（浸水系は色が同一スケールのため排他）。
const INITIAL_OVERLAYS = ["flood", "landslide"] as const;

async function loadHub() {
  const all = muniLevelOnly(await listAllAcrossPrefs());
  // ハザード評価のある自治体のうち人口上位 = 災害リスクデータへの主要な内部リンク先
  const popular = all
    .filter((m) => isHazardEvaluated(m.hazard.source))
    .sort((a, b) => b.population - a.population)
    .slice(0, 12);
  const prefsWithData = PREFS.filter((p) => all.some((m) => m.pref === p.slug));
  return { popular, prefsWithData };
}

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  metadataBase: new URL(SITE.baseUrl),
  alternates: { canonical: PATH },
  openGraph: {
    type: "website",
    locale: SITE.locale,
    url: absoluteUrl(PATH),
    title: TITLE,
    description: DESCRIPTION,
    siteName: SITE.name,
    images: [{ url: OG, width: 1200, height: 630, alt: "全国ハザードマップ" }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [OG] },
};

export default async function HazardMapPage() {
  // 地図の基盤タイルへ早期接続（ホームと同じリソースヒント）。
  ReactDOM.preconnect("https://tiles.openfreemap.org", { crossOrigin: "anonymous" });

  const summary = await listSummaryAcrossPrefs();
  const { popular, prefsWithData } = await loadHub();

  const ldJson = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: SITE.name, item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: "全国ハザードマップ", item: absoluteUrl(PATH) },
        ],
      },
      {
        "@type": "Dataset",
        name: "市区町村別 災害リスク（ハザードマップ・オーバーレイ）",
        description:
          "全国の洪水浸水想定・土砂災害警戒区域・津波/高潮浸水想定の区域（国土地理院ハザードマップポータルの公式タイル）と、市区町村単位の災害リスク評価（区域内最大区分）・指定緊急避難場所のデータセット。推計値は含まない。",
        url: absoluteUrl(PATH),
        keywords: ["ハザードマップ", "洪水", "浸水想定", "土砂災害", "津波", "高潮", "避難場所", "地図", "市区町村"],
        isAccessibleForFree: true,
        creator: { "@type": "Organization", name: SITE.name, url: SITE.baseUrl },
        spatialCoverage: { "@type": "Place", name: "日本" },
      },
    ],
  };

  return (
    <main className="home-main">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldJson) }} />
      <HomeShell
        summary={summary}
        initialMetric="none"
        initialOverlays={INITIAL_OVERLAYS}
        navLabel="ハザードマップから探す"
      >
        <HazardHub popular={popular} prefsWithData={prefsWithData} />
      </HomeShell>
    </main>
  );
}

function HazardHub({ popular, prefsWithData }: { popular: Municipality[]; prefsWithData: typeof PREFS }) {
  return (
    <div className="home-links-inner">
      <h1 className="home-links-lead-title">全国ハザードマップを地図で見る</h1>
      <p className="home-links-lead">
        洪水浸水想定と土砂災害警戒区域を重ねた地図です。地図を拡大すると、国土地理院ハザードマップポータルの公式タイルで実際の想定区域が表示されます。気になる街を検索するか地図を拡大して、住まい選びの災害リスクを確認してください。レイヤ切替から津波・高潮の浸水想定や指定緊急避難場所の表示にも切り替えられます。
      </p>
      <p className="home-links-lead">
        地図の自治体をクリックすると、その市区町村の災害リスク評価を確認できます。評価は自治体の区域内で確認された<strong>最大の区分</strong>を示すもので、自治体内のすべての場所が同じリスクという意味ではありません。区域の詳細は地図の拡大表示でご確認ください。
      </p>

      <section className="home-links-block">
        <h2 className="home-links-h">表示できる災害の種類</h2>
        <ul className="home-chip-row">
          {HAZARD_OVERLAYS.map((h) => (
            <li key={h.key}>
              <span className="home-chip" title={h.legend}>{h.label}</span>
            </li>
          ))}
          <li><span className="home-chip">指定緊急避難場所</span></li>
        </ul>
      </section>

      {popular.length > 0 && (
        <section className="home-links-block">
          <h2 className="home-links-h">主要都市の災害リスクを見る</h2>
          <ul className="home-chip-row">
            {popular.map((m) => (
              <li key={m.code}>
                <Link href={`/area/${m.pref}/${m.code}#hazard`} className="home-chip">
                  {prefNameOf(m.pref)}{m.displayName ?? m.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="home-links-block">
        <h2 className="home-links-h">都道府県別に見る</h2>
        <PrefRegionLinks
          href={(slug) => `/area/${slug}`}
          linkClassName="home-pref-link"
          gridClassName="home-pref-grid"
          prefs={prefsWithData}
        />
      </section>

      <p className="home-links-foot">
        © KurashiMap — 区域表示: 国土地理院 ハザードマップポータルサイト。自治体単位の評価: 不動産情報ライブラリ（reinfolib）。避難場所: 国土地理院 指定緊急避難場所データ。数値・区分はすべて公表値で、推計値は含みません。
      </p>
    </div>
  );
}
