import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ページが見つかりません",
  robots: { index: false, follow: false },
};

// 存在しない URL・削除された自治体コードなどの受け皿。Next デフォルトの英語 404 を
// サイトのトーンに合わせて置き換える。
export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: 24,
        textAlign: "center",
        background: "var(--bg)",
        color: "var(--text)",
      }}
    >
      <p style={{ fontSize: 44, fontWeight: 700, margin: 0, color: "var(--accent)" }}>404</p>
      <h1 style={{ fontSize: 20, margin: 0 }}>ページが見つかりません</h1>
      <p style={{ color: "var(--text-muted)", margin: 0, lineHeight: 1.8 }}>
        URL が変更されたか、ページが存在しません。
        <br />
        地図から市区町村を探すか、エリア検索をお試しください。
      </p>
      <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
        <Link
          href="/"
          style={{
            padding: "10px 20px",
            borderRadius: "var(--radius-sm)",
            background: "var(--accent)",
            color: "#fff",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          地図で探す
        </Link>
        <Link
          href="/search"
          style={{
            padding: "10px 20px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border-strong)",
            color: "var(--text)",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          エリア検索
        </Link>
      </div>
    </main>
  );
}
