import { getPrefBySlug } from "@/lib/prefs";
import { getHazardOverlay, isInundationKey, type HazardOverlay } from "@/lib/mapHazards";

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
 * path はトップの地図に限らず、/map/foreign-ratio 等の指標別ハブでも同じ
 * 仕組みでディープリンクできる（MapView はページによらず location.search を読む）。
 */
export function mapHrefForCode(code: string, path: string = "/"): string {
  return `${path}?code=${code}`;
}

/** 都道府県 slug で地図を開くリンク先（mapHrefForCode と同じく指標別ハブも path で指定可）。 */
export function mapHrefForPref(slug: string, path: string = "/"): string {
  return `${path}?pref=${slug}`;
}

/**
 * ?hazard= で指定できる災害オーバーレイ種別。型は HazardOverlay["key"] から導出し、
 * 実在チェック（オーバーレイ非対応の液状化の除外を含む）は parse 時の getHazardOverlay が担う。
 */
export type HazardDeepLinkKey = HazardOverlay["key"];

/**
 * ?hazard=flood,landslide の災害オーバーレイ指定を読み取る。実在するオーバーレイ種別のみ
 * 通し、浸水系（洪水・津波・高潮）は地図 UI と同じく排他選択なので最初の1件だけ残す。
 * 不正値・重複は黙って捨てる（code/pref と同じく寛容パース）。
 */
export function parseHazardDeepLink(search: string): HazardDeepLinkKey[] {
  const raw = new URLSearchParams(search).get("hazard");
  if (!raw) return [];
  // Set は挿入順を保つため、重複除去後も URL の指定順のまま
  const keys = [...new Set(raw.split(",").flatMap((p) => getHazardOverlay(p.trim())?.key ?? []))];
  const firstInundation = keys.find(isInundationKey);
  return keys.filter((k) => !isInundationKey(k) || k === firstInundation);
}

/**
 * 自治体コード＋災害オーバーレイ指定で地図を開くリンク先（エリア詳細の災害カード等）。
 * 該当自治体へフォーカスし、指定した種別のハザード区域を重ねた状態で開く。
 */
export function mapHrefForHazards(code: string, hazards: readonly HazardDeepLinkKey[]): string {
  return `${mapHrefForCode(code)}&hazard=${hazards.join(",")}`;
}
