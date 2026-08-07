import type { MuniSummary } from "./types";
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
