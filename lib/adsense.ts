import { DEFAULT_ADSENSE_CLIENT_ID, resolveAdsenseConfig } from "./adsensePolicy.mjs";

export function getAdsenseConfig() {
  // NEXT_PUBLIC_* は Next がビルド時に置換するため、動的な env アクセスにしない。
  return resolveAdsenseConfig({
    enabled: process.env.NEXT_PUBLIC_ADSENSE_ENABLED,
    production: process.env.NEXT_PUBLIC_ADSENSE_PRODUCTION,
    clientId: process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID ?? DEFAULT_ADSENSE_CLIENT_ID,
    rankingSlot: process.env.NEXT_PUBLIC_ADSENSE_RANKING_SLOT_ID,
    areaSlot: process.env.NEXT_PUBLIC_ADSENSE_AREA_SLOT_ID,
  });
}

export function navigateDocument(href: string, replace = false) {
  if (replace) window.location.replace(href);
  else window.location.assign(href);
}
