import type { Metadata } from "next";
import Link from "next/link";
import ReactDOM from "react-dom";
import HomeLinks, { getPopularMunis } from "@/components/HomeLinks";
import HeroSearch from "@/components/home/HeroSearch";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { listSummaryAcrossPrefs } from "@/lib/metrics";
import { GENERAL_MAP, MAP_HUBS } from "@/lib/siteNav";
import { SITE, absoluteUrl } from "@/lib/site";

const HOME_TITLE = "市区町村の住みやすさを地図で比較｜家賃・地価・子育て・災害リスク｜KurashiMap";
const HOME_DESC =
  "全国1,918エリア（市区町村と政令指定都市の行政区）の家賃相場・地価・人口・待機児童・災害リスク・外国人住民比率を地図で横断比較できる無料サービス。政府統計の実データだけを使い、推計値は使いません。気になる街の住みやすさをまとめてチェック。";

const HOME_OG = absoluteUrl("/api/og");

export const metadata: Metadata = {
  title: HOME_TITLE,
  description: HOME_DESC,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: absoluteUrl("/"),
    siteName: SITE.name,
    title: HOME_TITLE,
    description: HOME_DESC,
    images: [{ url: HOME_OG, width: 1200, height: 630, alt: SITE.name }],
  },
  twitter: { card: "summary_large_image", title: HOME_TITLE, description: HOME_DESC, images: [HOME_OG] },
};

export default async function HomePage() {
  // リソースヒント: 地図カードのプレビュー画像（ファーストビュー直下＝LCP候補）を先読み。
  // 地図本体は /map へ移設したため、基盤タイルへの preconnect は /map 側で行う。
  ReactDOM.preload("/initial-view.svg", { as: "image", type: "image/svg+xml" });

  // 軽量サマリはヒーロー検索（自治体コンボボックス）用。
  const summary = await listSummaryAcrossPrefs();
  const popular = await getPopularMunis();
  return (
    <>
      <main className="home-main">
      {/* ページヘッダー。スクロールするページなので、地図内のフローティングヘッダー
          ではなくページ最上部に置く（地図の面積を削らず、検索候補とも重ならない）。 */}
      <SiteHeader />

      {/* ファーストビュー: 何のサービスかを5秒で伝えるコピー＋詳細ページへ遷移する検索。
          その直下に地図（/map へ移設）への導線カードを据える。 */}
      <section className="home-hero">
        <div className="home-hero-inner">
          <h1 className="home-hero-title">データで、暮らす場所を考える。</h1>
          <p className="home-hero-sub">
            全国1,918エリア（市区町村と政令指定都市の行政区）を、家賃相場・地価・人口増減・待機児童・災害リスク・空き家率・外国人住民比率の公的データで調べて比較できます。推計値は使いません。
          </p>
          <HeroSearch munis={summary} />
          <p className="home-hero-actions">
            <a href="#home-explore" className="home-hero-action">都道府県から探す</a>
            <Link href="/ranking" className="home-hero-action">ランキングから探す</Link>
            <Link href="/compare" className="home-hero-action">自治体を比較する</Link>
          </p>
        </div>
      </section>

      {/* 地図への導線。地図本体は /map へ移設（操作性の悪い埋め込み協調ジェスチャ地図を
          廃止。docs/home-renewal-plan-2026-08.md PR-2）。プレビュー画像＋大きなタップ領域の
          カードで全画面地図へ、指標別ハブへはチップで直行できるようにする。 */}
      <section className="home-mapcta" aria-label="地図から探す">
        <Link href={GENERAL_MAP.href} className="home-mapcta-card">
          {/* eslint-disable-next-line @next/next/no-img-element -- ビルド時生成の静的SVG（最適化不要） */}
          <img src="/initial-view.svg" alt="" className="home-mapcta-img" />
          <span className="home-mapcta-body">
            <span className="home-mapcta-title">住みやすさマップを開く</span>
            <span className="home-mapcta-sub">
              家賃・地価・人口増減を色分け表示。災害リスクの重ね合わせや、自治体クリックで詳細データも。
            </span>
          </span>
        </Link>
        <ul className="home-chip-row home-mapcta-hubs">
          {MAP_HUBS.map((hub) => (
            <li key={hub.href}>
              <Link href={hub.href} className="home-chip">{hub.label}</Link>
            </li>
          ))}
        </ul>
      </section>

      {/* できること・回遊リンク帯（サーバーレンダリング＝クロール可能） */}
      <div className="home-content" id="home-explore">
        <HomeLinks popular={popular} />
      </div>
      </main>
      {/* main の外＝body スコープに置く（PageShell と同じ階層。footer が
          contentinfo ランドマークとして公開されるのは body スコープのときだけ） */}
      <SiteFooter />
    </>
  );
}
