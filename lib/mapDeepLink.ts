import { getPrefBySlug } from "@/lib/prefs";

// 地図ページのディープリンク（?code=13104 / ?pref=saitama）のパース。
// 「地図で見る」導線（自治体詳細・県ハブ）から、該当自治体・県へ初期フォーカスした
// 状態で地図を開くのに使う。code の実在確認（summary の byCode）は MapView 側で行う。
export type MapDeepLink =
  | { kind: "code"; code: string }
  | { kind: "pref"; slug: string };

/** location.search から地図ディープリンクを読み取る。code が pref より優先。不正値は null。 */
export function parseMapDeepLink(search: string): MapDeepLink | null {
  const params = new URLSearchParams(search);
  const code = params.get("code");
  if (code && /^\d{5}$/.test(code)) return { kind: "code", code };
  const slug = params.get("pref");
  if (slug && getPrefBySlug(slug)) return { kind: "pref", slug };
  return null;
}

/**
 * 自治体コードで地図を開くリンク先（「地図で見る」導線の送り側で共通利用）。
 * 既定の行き先は汎用の全画面地図 /map。path 指定で /map/foreign-ratio 等の指標別
 * ハブへも同じ仕組みでディープリンクできる（MapView はページによらず location.search を読む）。
 */
export function mapHrefForCode(code: string, path: string = "/map"): string {
  return `${path}?code=${code}`;
}

/** 都道府県 slug で地図を開くリンク先（mapHrefForCode と同じく指標別ハブも path で指定可）。 */
export function mapHrefForPref(slug: string, path: string = "/map"): string {
  return `${path}?pref=${slug}`;
}
