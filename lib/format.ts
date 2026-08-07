// 汎用の小さな数値フォーマッタ。複数の指標モジュール（highlights・compareMetrics）が
// 同じ書式（符号付きパーセント）を必要とするための共有先。lib/rankings.ts の
// 既存のランキング表示ロジックは対象範囲外のためここでは変更しない。

/** 符号付きパーセント表示。例: signedPct(3.2) → "+3.2", signedPct(-1.5) → "-1.5" */
export function signedPct(value: number, decimals = 1): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(decimals)}`;
}
