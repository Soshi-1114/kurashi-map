// Next config とブラウザで共有する。静的配信のまま広告ページの CSP を切り替える。
export const DEFAULT_ADSENSE_CLIENT_ID = "ca-pub-5168889916977587";

export function resolveAdsenseConfig(input) {
  const clientId = /^ca-pub-\d{16}$/.test(input.clientId?.trim() ?? "") ? input.clientId.trim() : null;
  const slot = value => /^\d{10}$/.test(value?.trim() ?? "") ? value.trim() : null;
  return {
    enabled: input.enabled === "true" && clientId !== null,
    production: input.production === "true",
    clientId,
    slots: { ranking: slot(input.rankingSlot), area: slot(input.areaSlot) },
  };
}

export function adPageGroup(pathname) {
  if (/^\/ranking\/[a-z][a-z0-9-]*(?:\/[a-z][a-z0-9-]*)?\/?$/.test(pathname)) return "ranking";
  if (/^\/area\/[a-z][a-z0-9-]*(?:\/\d{5})?\/?$/.test(pathname)) return "area";
  return null;
}

export function hasAdsForPath(config, pathname) {
  const group = adPageGroup(pathname);
  return config.enabled && group !== null && config.slots[group] !== null;
}

export function requiresDocumentNavigation(config, current, destination) {
  // ページ内の移動や入力に伴うクエリ更新では文書を読み直さない。
  return current.origin === destination.origin && current.pathname !== destination.pathname &&
    (hasAdsForPath(config, current.pathname) || hasAdsForPath(config, destination.pathname));
}

export function canServeAds(config, location) {
  return config.enabled && config.production && location.hostname === "kurashimap.jp" && location.protocol === "https:";
}
