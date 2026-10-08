import type { Metadata } from "next";
import Link from "next/link";
import ReactDOM from "react-dom";
import HomeLinks, { getPopularMunis } from "@/components/HomeLinks";
import HeroSearch from "@/components/home/HeroSearch";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { listSummaryAcrossPrefs } from "@/lib/metrics";
import type { MuniSearchItem } from "@/lib/useMuniCombobox";
import { GENERAL_MAP, MAP_HUBS, shindanHref } from "@/lib/siteNav";
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

  // ヒーロー検索（自治体コンボボックス）用。検索が読むフィールドだけに射影して
  // クライアントへ渡す（地図色付け用フィールド込みのフル MuniSummary は raw ~540KB で、
  // 地図の /map 移設後のトップには過剰。射影後は raw ~180KB）。
  const searchMunis: MuniSearchItem[] = (await listSummaryAcrossPrefs()).map(
    ({ code, pref, name, displayName, kana, level }) => ({ code, pref, name, displayName, kana, level }),
  );
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
          <div className="home-hero-copy">
            <h1 className="home-hero-title">暮らす街を、データで見比べる。</h1>
            <p className="home-hero-sub">
              全国1,918の市区町村・行政区を、公的データで比較。家賃、地価、人口、子育て、災害リスクを確かめられます。推計値は使いません。
            </p>
            <HeroSearch munis={searchMunis} />
            <p className="home-hero-actions">
              <a href="#home-explore" className="home-hero-action">都道府県から探す</a>
              <Link href="/ranking" className="home-hero-action">ランキング</Link>
              <Link href="/compare" className="home-hero-action">自治体を比較</Link>
              <Link href={shindanHref("home")} className="home-hero-action">住む街診断</Link>
            </p>
          </div>
          <section className="home-mapcta" aria-label="地図から探す">
            <Link href={GENERAL_MAP.href} className="home-mapcta-card">
              {/* eslint-disable-next-line @next/next/no-img-element -- ビルド時生成の静的SVG（最適化不要） */}
              <img src="/initial-view.svg" alt="" className="home-mapcta-img" />
              <span className="home-mapcta-body">
                <span className="home-mapcta-title">地図で街を探す</span>
                <span className="home-mapcta-sub">指標の色分け、災害リスク、自治体ごとの詳細を地図で確認できます。</span>
              </span>
            </Link>
            <ul className="home-chip-row home-mapcta-hubs">
              {MAP_HUBS.map((hub) => (
                <li key={hub.href}><Link href={hub.href} className="home-chip">{hub.label}</Link></li>
              ))}
            </ul>
          </section>
        </div>
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
