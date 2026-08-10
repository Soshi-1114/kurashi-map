"use client";

// ルート直下の error boundary。ページ描画中の予期しない例外（データ不整合・
// チャンクロード失敗など）で Next デフォルトの無機質な画面に落ちないようにする。
// reset() は該当セグメントの再レンダリングを試みる。
// 配色・余白・ボタンは共通クラス（.status-* / .btn-*）に揃える。
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="status-page">
      <h1 className="status-title">問題が発生しました</h1>
      <p className="status-text">
        ページの表示中にエラーが発生しました。再試行しても直らない場合は、
        <br />
        時間をおいて再度アクセスしてください。
        {error.digest ? (
          <>
            <br />
            <span className="status-digest">エラーID: {error.digest}</span>
          </>
        ) : null}
      </p>
      <div className="status-actions">
        <button type="button" onClick={reset} className="btn btn-primary">
          もう一度試す
        </button>
        {/* エラーバウンダリでは <Link> のクライアント遷移ではなく、素の <a> で
            ハードリロードして壊れたクライアント状態ごとリセットする（意図的）。
            no-html-link-for-pages は通常ページ向けの規則なのでここは無効化する。 */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="btn btn-secondary">
          トップへ戻る
        </a>
      </div>
    </main>
  );
}
