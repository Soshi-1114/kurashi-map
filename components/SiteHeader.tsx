import Link from "next/link";
import { SITE } from "@/lib/site";

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
          <Link href="/denki" prefetch={false}>電気代</Link>
          {/* SP では横幅が足りないため隠す。共通フッター（SiteFooter）に同じ導線がある */}
          <Link href="/about" className="site-header-nav-optional">このサイトについて</Link>
        </nav>
      </div>
    </header>
  );
}
