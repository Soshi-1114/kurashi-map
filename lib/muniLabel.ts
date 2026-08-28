import type { Municipality, MuniSummary } from "./types";
import { getPrefByCode } from "./prefs";

/**
 * 検索候補行の補足ラベル（町丁ヒットは町丁名、駅ヒットは「〇〇駅」）。
 * S12 の駅名は「駅」なしのため、表示側でサフィックスを付ける規則をここに一元化する
 * （候補行の表示と地図ピンの aria-label が同じ規則を共有し、ずれない）。
 */
export function comboboxHitSuffix(m: { town?: string; station?: { name: string } }): string | null {
  if (m.station) return `${m.station.name}駅`;
  return m.town ?? null;
}

// 検索候補に添える所属コンテキスト（都道府県名。政令市の区は「県名 市名」）。
// 同名自治体（府中市=東京/広島、北区=東京/大阪市/さいたま市…）の誤選択を防ぐ。
// 地図ヘッダー検索・トップのヒーロー検索・比較ページのピッカーが共有する。
// 引数は読むフィールドだけの構造的部分型（検索専用の軽量射影 MuniSearchItem でも呼べる）。
export function muniContextLabel(m: Pick<MuniSummary, "code" | "level" | "displayName" | "name">): string {
  const prefName = getPrefByCode(m.code)?.nameJa ?? "";
  if (m.level === "ward" && m.displayName) {
    const city = m.displayName.replace(m.name, "").trim();
    if (city) return `${prefName} ${city}`.trim();
  }
  return prefName;
}

type NamedMuni = Pick<Municipality, "pref" | "name"> & { displayName?: string };

/**
 * 複数の都道府県に同じ表示名が存在する自治体名の集合（池田町=北海道/福井/長野/岐阜、
 * 美浜町=福井/愛知/和歌山 など25名称・57ページ）。
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
  // 名前ごとに「最初に見た県」だけ覚え、違う県で再出現したらその時点で曖昧と確定する。
  const firstPrefByLabel = new Map<string, string>();
  const ambiguous = new Set<string>();
  for (const m of all) {
    const label = m.displayName ?? m.name;
    const seen = firstPrefByLabel.get(label);
    if (seen === undefined) firstPrefByLabel.set(label, m.pref);
    else if (seen !== m.pref) ambiguous.add(label);
  }
  return ambiguous;
}

// 構築結果ではなく Promise をキャッシュする。ビルドは generateMetadata を複数ページ
// 並行で走らせるため、値をキャッシュすると最初の一群が揃って未設定の状態を通過し、
// 同じ構築を人数ぶん重複実行してしまう（lib/metrics.ts の pref ロードと同じ方針）。
let ambiguousCache: Promise<Set<string>> | null = null;

/** 全 pref 横断の同名自治体セットを返す（初回のみ構築してキャッシュ）。 */
export function getAmbiguousNames(): Promise<Set<string>> {
  // metrics は data/*.json を引き込むため、クライアントに配られるこのモジュールからは
  // 静的 import せず、キャッシュミス時にだけ動的 import する。
  ambiguousCache ??= import("./metrics").then(({ listAllAcrossPrefs }) =>
    listAllAcrossPrefs().then(buildAmbiguousNames),
  );
  return ambiguousCache;
}
