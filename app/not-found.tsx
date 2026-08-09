import Link from "next/link";
import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "ページが見つかりません",
  robots: { index: false, follow: false },
};

// 存在しない URL・削除された自治体コードなどの受け皿。Next デフォルトの英語 404 を
// サイトのトーンに合わせて置き換える。配色・余白・ボタンはすべて共通クラス
// （.status-* / .btn-*）を使い、他ページと同じデザインシステム上に載せる。
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="status-page">
        <p className="status-code">404</p>
        <h1 className="status-title">ページが見つかりません</h1>
        <p className="status-text">
          URL が変更されたか、ページが存在しません。
          <br />
          地図から市区町村を探すか、エリア検索をお試しください。
        </p>
        <div className="status-actions">
          <Link href="/" className="btn btn-primary">地図で探す</Link>
          <Link href="/search" className="btn btn-secondary">エリア検索</Link>
        </div>
      </main>
    </>
  );
}
