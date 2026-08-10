// 数値の丸め・パーセント表示。CSV / Markdown / analysis.json で共通利用する。

export function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

/** 0-1 の比率を "12.3%" 形式にする。 */
export function pctText(ratio: number, decimals = 2): string {
  return `${round(ratio * 100, decimals)}%`;
}

export function positionText(position: number): string {
  return round(position, 1).toString();
}

/** 前期間比の増減率。prev=0 の場合は現在値>0 なら "新規", 0 なら "-" 。 */
export function deltaPctText(current: number, prev: number): string {
  if (prev === 0) return current > 0 ? "新規" : "-";
  return `${round(((current - prev) / prev) * 100, 1)}%`;
}

/**
 * 増減の符号付き表示。0 は "±0" にして「変化なし」と「未計測」を見分けられるようにする。
 * 例: signedText(12) → "+12" / signedText(-0.3, 1) → "-0.3" / signedText(1.2, 2, "pt") → "+1.2pt"
 */
export function signedText(n: number, decimals = 0, unit = ""): string {
  const v = round(n, decimals);
  const sign = v > 0 ? "+" : v < 0 ? "" : "±";
  return `${sign}${v}${unit}`;
}
