// かな正規化ユーティリティ。検索クエリと読みデータ（ひらがな）の照合に使う。

/** カタカナ→ひらがな（長音符・漢字・英数はそのまま）。 */
export function toHiragana(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}
