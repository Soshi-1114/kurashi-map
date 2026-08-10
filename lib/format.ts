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

/**
 * 簡易バーの幅(%)。極小値でも視認できるよう最小4%を保証する
 * （components/area/CompareBar.tsx・比較ページのバーが共有する）。
 * max は呼び出し側で 0除算を避ける床（通常1）を設けておくこと。
 */
export function barWidthPct(value: number, max: number): number {
  return Math.max(4, (value / max) * 100);
}

// ===== title 用の短縮表記 =====
// 検索結果の title は日本語で概ね30文字前後で切れるため、桁数の多い実数値は
// 「万」に丸めて文字数を節約する。ページ本文・description は実数のまま扱う
// （丸めるのは表示の都合であって、データを推計・改変するものではない）。

/** 人口の短縮表記。例: 695043 → "69.5万人"、1096951 → "110万人"、3456 → "3,456人"。 */
export function compactPopulation(value: number): string {
  if (value < 10000) return `${value.toLocaleString()}人`;
  const man = value / 10000;
  // 100万人以上は小数を落とす（"109.7万人" より "110万人" のほうが読みやすい）。
  return man >= 100 ? `${Math.round(man).toLocaleString()}万人` : `${man.toFixed(1)}万人`;
}

/** 金額の短縮表記。例: 78000 → "7.8万円"、9500 → "9,500円"。 */
export function compactYen(value: number): string {
  if (value < 10000) return `${value.toLocaleString()}円`;
  return `${(value / 10000).toFixed(1)}万円`;
}
