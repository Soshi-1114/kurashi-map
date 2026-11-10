export type AdPageGroup = "ranking" | "area";
export declare const DEFAULT_ADSENSE_CLIENT_ID: string;
export type AdsenseConfig = {
  enabled: boolean;
  production: boolean;
  clientId: string | null;
  slots: Record<AdPageGroup, string | null>;
};
export declare function resolveAdsenseConfig(input: {
  enabled?: string; production?: string; clientId?: string; rankingSlot?: string; areaSlot?: string;
}): AdsenseConfig;
export declare function adPageGroup(pathname: string): AdPageGroup | null;
export declare function hasAdsForPath(config: AdsenseConfig, pathname: string): boolean;
export declare function requiresDocumentNavigation(config: AdsenseConfig, current: URL, destination: URL): boolean;
export declare function canServeAds(config: AdsenseConfig, location: Pick<Location, "hostname" | "protocol">): boolean;
