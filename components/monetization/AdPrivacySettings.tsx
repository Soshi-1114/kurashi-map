"use client";

import { useEffect, useState } from "react";
import { getAdsenseConfig } from "@/lib/adsense";
import { canServeAds, hasAdsForPath } from "@/lib/adsensePolicy.mjs";

type GoogleConsent = {
  callbackQueue: Array<{ CONSENT_API_READY: () => void }>;
  showRevocationMessage?: () => void;
};

export default function AdPrivacySettings() {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    const config = getAdsenseConfig();
    if (!canServeAds(config, window.location) || !hasAdsForPath(config, window.location.pathname)) return;
    let active = true;
    const target = window as Window & { googlefc?: GoogleConsent };
    const consent = target.googlefc = target.googlefc || { callbackQueue: [] };
    consent.callbackQueue = consent.callbackQueue || [];
    const ready = () => {
      if (active && typeof target.googlefc?.showRevocationMessage === "function") setAvailable(true);
    };
    consent.callbackQueue.push({ CONSENT_API_READY: ready });
    ready();
    return () => { active = false; };
  }, []);
  if (!available) return null;
  return <button type="button" className="display-ad-privacy" onClick={() => {
    const target = window as Window & { googlefc?: GoogleConsent };
    target.googlefc?.showRevocationMessage?.();
  }}>プライバシーとCookieの設定</button>;
}
