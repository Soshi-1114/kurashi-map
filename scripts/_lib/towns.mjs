// 町丁名・読み仮名データ生成（fetch-towns.mjs）の純粋関数群。
// テスト: tests/scripts/towns.test.ts

/** カタカナ→ひらがな（長音符・記号はそのまま）。lib/kana.ts の同名関数と同ロジック（変更時は両方直す）。 */
export function toHiragana(s) {
  return String(s ?? "").replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

/**
 * 「旭ケ丘一丁目」→「旭ケ丘」のように末尾の丁目表記を落として大字単位に畳む。
 * 名前全体が丁目表記のみ（例「一丁目」）の場合は畳まず元の名前を返す。
 */
export function collapseChome(name) {
  const collapsed = String(name ?? "").replace(/[〇一二三四五六七八九十百]+丁目$/, "");
  return collapsed.length > 0 ? collapsed : String(name ?? "");
}

/** 町丁カナ「アサヒガオカ 1」→「あさひがおか」（末尾の丁目数字と空白を除去してひらがな化）。 */
export function townKanaToHiragana(kana) {
  return toHiragana(String(kana ?? "").replace(/[\s\d０-９]+$/, "").trim());
}

/**
 * 政令市（親市）の読み（ひらがな）を区の読み（ひらがな）から導出する。
 * 位置参照情報は区単位（例「さっぽろしちゅうおうく」）で親市の行を持たないため、
 * 全区の読みの最長共通接頭辞を取り、市名の末尾「し」で切る（名古屋市の中区/中村区/
 * 中川区のように区名側の共通音で接頭辞が伸びるケースを「最後のしまで」で打ち切る）。
 * 導出できない（区の読みが無い・しを含まない）場合は null。
 */
export function cityKanaFromWardKanas(wardKanas) {
  const kanas = wardKanas.filter((k) => typeof k === "string" && k.length > 0);
  if (kanas.length === 0) return null;
  let lcp = kanas[0];
  for (const k of kanas.slice(1)) {
    let i = 0;
    while (i < lcp.length && i < k.length && lcp[i] === k[i]) i++;
    lcp = lcp.slice(0, i);
  }
  const cut = lcp.lastIndexOf("し");
  if (cut < 0) return null;
  return lcp.slice(0, cut + 1);
}
