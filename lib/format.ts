// 汎用の小さな数値フォーマッタ。複数の指標モジュール（highlights・compareMetrics）が
// 同じ書式（符号付きパーセント）を必要とするための共有先。lib/rankings.ts の
// 既存のランキング表示ロジックは対象範囲外のためここでは変更しない。

// "2024-12"・"2025-04-01" → "2024年12月"・"2025年4月"。データ asOf を見出し・出典表示の
// 鮮度ラベルへ整形する（日付は月に丸める）。整形できない形式（和暦・複合ラベル等）はそのまま返す。
// 定義をここ（純粋フォーマッタの共有先）に置くのは、クライアントコンポーネント
// （AreaPanel・cards 等）が lib/rankings から import すると RANKINGS 全文（intro/FAQ の
// 生テキスト数十KB）が地図ページのクライアントチャンクへ同梱されるため。
// サーバー側の既存呼び出しのために lib/rankings が再exportしている。
export function formatAsOfJa(asOf: string): string {
  const m = /^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/.exec(asOf ?? "");
  if (m) return `${m[1]}年${Number(m[2])}月`;
  const y = /^(\d{4})$/.exec(asOf ?? "");
  if (y) return `${y[1]}年`;
  return asOf ?? "";
}

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

/**
 * 「万」単位の短縮表記。1万未満は実数のまま、100万以上は小数を落とす
 * （"109.7万" より "110万" のほうが読みやすい）。単位は呼び出し側が渡す。
 */
function compactMan(value: number, unit: string): string {
  if (value < 10000) return `${value.toLocaleString()}${unit}`;
  const man = value / 10000;
  return `${man >= 100 ? Math.round(man) : man.toFixed(1)}万${unit}`;
}

/** 人口の短縮表記。例: 695043 → "69.5万人"、1096951 → "110万人"、3456 → "3,456人"。 */
export function compactPopulation(value: number): string {
  return compactMan(value, "人");
}

/** 金額の短縮表記。例: 78000 → "7.8万円"、9500 → "9,500円"。 */
export function compactYen(value: number): string {
  return compactMan(value, "円");
}

/** 金額の桁区切り表記（短縮しない）。例: 9607 → "9,607円"。 */
export function yen(value: number): string {
  return `${value.toLocaleString("ja-JP")}円`;
}
