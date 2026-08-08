// かな正規化ユーティリティ。検索クエリと読みデータ（ひらがな）の照合に使う。
// scripts/_lib/towns.mjs にも同名・同ロジックの実装がある（lib/prefs.ts と
// scripts/_lib/prefs.mjs の分離と同じ理由＝アプリ実行時とデータ生成スクリプトで
// ランタイムが異なる（TS vs 素の .mjs）ため共有できない）。変更する時は両方直す。

/** カタカナ→ひらがな（長音符・漢字・英数はそのまま）。 */
export function toHiragana(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}
