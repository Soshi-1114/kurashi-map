import type { Municipality, MuniSummary } from "./types";
import { getPrefByCode } from "./prefs";

// 検索候補に添える所属コンテキスト（都道府県名。政令市の区は「県名 市名」）。
// 同名自治体（府中市=東京/広島、北区=東京/大阪市/さいたま市…）の誤選択を防ぐ。
// 地図ヘッダー検索・トップのヒーロー検索・比較ページのピッカーが共有する。
export function muniContextLabel(m: MuniSummary): string {
  const prefName = getPrefByCode(m.code)?.nameJa ?? "";
  if (m.level === "ward" && m.displayName) {
    const city = m.displayName.replace(m.name, "").trim();
    if (city) return `${prefName} ${city}`.trim();
  }
  return prefName;
}

type NamedMuni = Pick<Municipality, "pref" | "name"> & { displayName?: string };

/**
 * 複数の都道府県に同じ表示名が存在する自治体名の集合（池田町=北海道/福井/岐阜/大阪、
 * 美浜町=福井/愛知/和歌山 など26名称・59ページ）。
 *
 * 詳細ページの title は文字数が厳しく全件に県名を添えると本題の数値が切れるため、
 * 「名前だけでは検索結果で区別できないページ」に限って県名を添える判定に使う。
 * 政令市の行政区は displayName が「大阪市北区」のようにフル名称なので衝突しない。
 *
 * 判定は「2つ以上の県にまたがる同名」のみ。同一県内の重複（北海道の泊村＝積丹郡と
 * 北方領土の2件だけ）は県名を添えても区別できないため対象外で、こちらは北方領土側が
 * 人口0＝数値なしの title になることで自然に分かれる。
 */
export function buildAmbiguousNames(all: NamedMuni[]): Set<string> {
  const prefsByLabel = new Map<string, Set<string>>();
  for (const m of all) {
    const label = m.displayName ?? m.name;
    const prefs = prefsByLabel.get(label);
    if (prefs) prefs.add(m.pref);
    else prefsByLabel.set(label, new Set([m.pref]));
  }
  const ambiguous = new Set<string>();
  for (const [label, prefs] of prefsByLabel) {
    if (prefs.size > 1) ambiguous.add(label);
  }
  return ambiguous;
}

let ambiguousCache: Set<string> | null = null;

/** 全 pref 横断の同名自治体セットを返す（初回のみ構築してキャッシュ。rankingStats と同方針）。 */
export async function getAmbiguousNames(): Promise<Set<string>> {
  if (!ambiguousCache) {
    const { listAllAcrossPrefs } = await import("./metrics");
    ambiguousCache = buildAmbiguousNames(await listAllAcrossPrefs());
  }
  return ambiguousCache;
}
