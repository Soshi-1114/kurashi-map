// 汎用の小さな数値フォーマッタ。複数の指標モジュール（highlights・compareMetrics）が
// 同じ書式（符号付きパーセント）を必要とするための共有先。lib/rankings.ts の
// 既存のランキング表示ロジックは対象範囲外のためここでは変更しない。

/**
 * 符号付きパーセント表示。例: signedPct(3.2) → "+3.2", signedPct(-1.5) → "-1.5"
 * 丸めた結果がちょうど0になる値（例: -0.005）は "-0.0" のような矛盾表示を避け "0.0" を返す。
 */
export function signedPct(value: number, decimals = 1): string {
  const rounded = Number(value.toFixed(decimals));
  if (rounded === 0) return (0).toFixed(decimals);
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(decimals)}`;
}
