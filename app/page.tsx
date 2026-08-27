import type { Metadata } from "next";
import Link from "next/link";
import ReactDOM from "react-dom";
import MapView from "@/components/MapView";
import HomeLinks, { getPopularMunis } from "@/components/HomeLinks";
import HeroSearch from "@/components/home/HeroSearch";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { listSummaryAcrossPrefs } from "@/lib/metrics";
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
  // リソースヒント（ホームのみ）。地図の基盤タイル(OpenFreeMap)へ早期に接続を張り、
  // LCP 要素である初期スケルトン画像を最優先で取得させ、初期描画を前倒しする。
  // 基盤タイルは CORS(fetch) 取得なので preconnect は crossOrigin 付き。
  ReactDOM.preconnect("https://tiles.openfreemap.org", { crossOrigin: "anonymous" });
  ReactDOM.preload("/initial-view.svg", { as: "image", type: "image/svg+xml" });

  // 初期配信は軽量サマリのみ（検索・地図色付け用）。各自治体の詳細は
  // 選択時に /api/muni/[code] で取得する。
  const summary = await listSummaryAcrossPrefs();
  const popular = await getPopularMunis();
  return (
    <>
      <main className="home-main">
      {/* ページヘッダー。スクロールするページなので、地図内のフローティングヘッダー
          ではなくページ最上部に置く（地図の面積を削らず、検索候補とも重ならない）。 */}
      <SiteHeader />

      {/* ファーストビュー: 何のサービスかを5秒で伝えるコピー＋詳細ページへ遷移する検索。
          地図（プロダクトの中核）はその直下に据える。 */}
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

      {/* 地図。スクロールするページへの埋め込みなので協調ジェスチャを有効化
          （SP: 2本指パン / PC: Ctrl+ホイールでズーム）。検索はFVのヒーロー検索に、
          ロゴ・ナビはページヘッダーに一本化するため、地図内ヘッダーは出さない。 */}
      <div className="home-map home-map--embedded">
        <MapView summary={summary} cooperativeGestures showSearch={false} showHeader={false} />
      </div>

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
