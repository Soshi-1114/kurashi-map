"use client";

// ルート直下の error boundary。ページ描画中の予期しない例外（データ不整合・
// チャンクロード失敗など）で Next デフォルトの無機質な画面に落ちないようにする。
// reset() は該当セグメントの再レンダリングを試みる。
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
      <h1 style={{ fontSize: 20, margin: 0 }}>問題が発生しました</h1>
      <p style={{ color: "var(--text-muted)", margin: 0, lineHeight: 1.8 }}>
        ページの表示中にエラーが発生しました。再試行しても直らない場合は、
        <br />
        時間をおいて再度アクセスしてください。
        {error.digest ? (
          <>
            <br />
            <span style={{ color: "var(--text-faint)", fontSize: 12 }}>エラーID: {error.digest}</span>
          </>
        ) : null}
      </p>
      <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
        <button
          type="button"
          onClick={reset}
          style={{
            padding: "10px 20px",
            borderRadius: "var(--radius-sm)",
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          もう一度試す
        </button>
        <a
          href="/"
          style={{
            padding: "10px 20px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border-strong)",
            color: "var(--text)",
            textDecoration: "none",
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          トップへ戻る
        </a>
      </div>
    </main>
  );
}
