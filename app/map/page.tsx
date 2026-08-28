// 汎用の全画面地図ページ（住みやすさマップ）。トップの埋め込み地図に対する
// 「地図体験の本体」で、「地図で見る」ディープリンク（?code= / ?pref=）の既定の行き先。
// 指標別ハブ（/map/rent 等）と同じ HomeShell 構成（全画面地図＋ドロワーのリンク帯）で、
// リンク帯にはトップと同じ HomeLinks を出す。経緯は docs/home-renewal-plan-2026-08.md。

import ReactDOM from "react-dom";
import HomeShell from "@/components/HomeShell";
import HomeLinks, { getPopularMunis } from "@/components/HomeLinks";
import { hubMetadata } from "@/components/MetricMapHub";
import { listSummaryAcrossPrefs } from "@/lib/metrics";
import { SITE, absoluteUrl } from "@/lib/site";

const PATH = "/map";
const OG = absoluteUrl("/api/og");

const TITLE = `住みやすさマップ｜家賃・地価・人口・災害リスクを地図で比較 - ${SITE.name}`;
const DESCRIPTION =
  "全国1,918の市区町村・行政区を、家賃相場・地価・人口増減などの公的データで色分けした全画面地図。指標の切り替えや災害リスクの重ね合わせができ、自治体をクリックすると住環境データの詳細を確認できます。";

export const metadata = hubMetadata({
  path: PATH,
  title: TITLE,
  description: DESCRIPTION,
  ogImage: OG,
  ogAlt: "住みやすさマップ",
});

export default async function GeneralMapPage() {
  // 地図がページそのもの＝LCP。基盤タイルへの早期接続と初期スケルトン画像の先読みは
  // トップの地図と同じ扱い。
  ReactDOM.preconnect("https://tiles.openfreemap.org", { crossOrigin: "anonymous" });
  ReactDOM.preload("/initial-view.svg", { as: "image", type: "image/svg+xml" });

  const summary = await listSummaryAcrossPrefs();
  const popular = await getPopularMunis();

  // 単一ノードなので @graph で包まない（hubLdJson は Dataset を伴うハブ用で、ここでは過剰）。
  const ldJson = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: SITE.name, item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: "住みやすさマップ", item: absoluteUrl(PATH) },
    ],
  };

  return (
    <main className="home-main">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldJson) }} />
      <HomeShell summary={summary}>
        <HomeLinks popular={popular} />
      </HomeShell>
    </main>
  );
}
