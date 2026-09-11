import Link from "next/link";
import { SITE } from "@/lib/site";
import { shindanHref } from "@/lib/siteNav";

// スクロールするページ用のページヘッダー（サーバーコンポーネント＝リンクは HTML に載る）。
// 全画面地図のピラーページは地図内のフローティングヘッダー（MapView の .app-header。
// 検索とメニューを持つ）を使うので、そちらとは併用しない。
export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="site-header-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" className="brand-mark" width={30} height={30} />
          <span className="brand-name">{SITE.name}</span>
        </Link>
        <nav className="site-header-nav" aria-label="サイト内メニュー">
          <Link href="/ranking">ランキング</Link>
          <Link href="/compare">自治体を比較</Link>
          {/* SP は横幅制約でラベルを短縮する（ブランド名は隠さない設計のため。globals.css 参照） */}
          <Link href={shindanHref("header")} prefetch={false}>
            <span className="site-header-nav-long">住む街診断</span>
            <span className="site-header-nav-short">診断</span>
          </Link>
          {/* SP では横幅が足りないため隠す。共通フッター（SiteFooter）に同じ導線がある。
              電気代は SEO 流入を狙わない内部送客用の道具なので、SP では診断を優先する */}
          <Link href="/denki" className="site-header-nav-optional" prefetch={false}>電気代</Link>
          <Link href="/about" className="site-header-nav-optional">このサイトについて</Link>
        </nav>
      </div>
    </header>
  );
}
