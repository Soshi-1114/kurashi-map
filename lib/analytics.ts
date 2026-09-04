// GA4（gtag.js）へのカスタムイベント送信ヘルパー。
// gtag は app/layout.tsx で afterInteractive ロードされる。スクリプト未ロード時や
// SSR 時は no-op になるよう、毎回 window.gtag の存在を確認してから呼ぶ。
//
// honesty 方針と同様、計測も「実際に起きたこと」だけを送る。推測値や水増しはしない。

import type { MapFilters } from "./mapFilters";

type GtagFn = (command: "event", eventName: string, params?: Record<string, unknown>) => void;

declare global {
  interface Window {
    gtag?: GtagFn;
  }
}

/** GA4 へカスタムイベントを1件送る。gtag 未ロード時・SSR 時は何もしない。 */
export function track(eventName: string, params?: Record<string, unknown>): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", eventName, params);
}

/** 自治体の選択（地図クリック／検索／ディープリンク）。method で導線を区別する。 */
export function trackSelectMunicipality(code: string, method: "map" | "search" | "link"): void {
  track("select_municipality", { municipality_code: code, method });
}

/** 自治体詳細ページのセクションナビでの移動。どのセクションが実際に使われているかを見る。 */
export function trackSelectSection(sectionId: string, municipalityCode: string): void {
  track("select_section", { section: sectionId, municipality_code: municipalityCode });
}

/** 塗り分け指標の切り替え。 */
export function trackChangeMetric(metricKey: string): void {
  track("change_metric", { metric_key: metricKey });
}

/** 条件フィルタの適用。どの条件が有効かを送る。 */
export function trackApplyFilter(params: MapFilters): void {
  track("apply_filter", {
    rent_max: params.rentMax ?? 0,
    land_max: params.landMax ?? 0,
    flood_max: params.floodMax ?? -1, // -1=条件なし（0=浸水なしに限定と区別）
    vacancy_max: params.vacancyMax ?? 0, // 0=条件なし（選択肢は10/15/20のみ）
    aging_max: params.agingMax ?? 0, // 0=条件なし（選択肢は30/35/40のみ）
    future_min: params.futureMin ?? -999, // -999=条件なし（0=増加見込みに限定と区別）
  });
}

/** 街診断の実行（重み・地方の組み合わせ変更ごとに1回）。 */
export function trackShindanRun(params: { weights: string; regions: string; resultCount: number }): void {
  track("shindan_run", {
    weights: params.weights,       // SHINDAN_AXES 順の6桁（例 "210120"）
    regions: params.regions,       // 地方キーのカンマ区切り（空=全国）
    result_count: params.resultCount,
  });
}

/** 街診断の結果から自治体詳細への遷移。 */
export function trackShindanResultClick(code: string, position: number): void {
  track("shindan_result_click", { municipality_code: code, position });
}

/** ページ共有（GA4 推奨イベント）。method はOS共有シートかURLコピーか。 */
export function trackShare(params: { method: "web_share" | "copy"; contentType: string; itemId: string }): void {
  track("share", {
    method: params.method,
    content_type: params.contentType,
    item_id: params.itemId,
  });
}

/** 電気料金シミュレーション実行（/denki）。入力確定ごとに1回（連続入力は呼び出し側で debounce）。 */
export function trackDenkiSimulate(params: {
  area: string;
  householdSize: number;
  kwh: number;
  kwhOverridden: boolean;
  ampere: number;
  municipalityCode?: string;
}): void {
  track("denki_simulate", {
    area: params.area,
    household_size: params.householdSize,
    kwh: params.kwh,
    kwh_overridden: params.kwhOverridden,
    ampere: params.ampere,
    ...(params.municipalityCode ? { municipality_code: params.municipalityCode } : {}),
  });
}

/** 電気料金の比較結果リスト表示（エリアごとに1回）。オファー別 CTR の分母。 */
export function trackDenkiOfferImpression(params: { area: string; offerCount: number; hasAffiliate: boolean }): void {
  track("denki_offer_impression", {
    area: params.area,
    offer_count: params.offerCount,
    has_affiliate: params.hasAffiliate,
  });
}

/** 電気プランの外部リンククリック。オファー別 CTR の分子・キーイベント候補。 */
export function trackDenkiOfferClick(params: {
  offerId: string;
  area: string;
  isAffiliate: boolean;
  position: number;
}): void {
  track("denki_offer_click", {
    offer_id: params.offerId,
    area: params.area,
    is_affiliate: params.isAffiliate,
    position: params.position,
  });
}
