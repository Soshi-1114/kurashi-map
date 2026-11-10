"use client";

import { useEffect, useRef } from "react";
import { getAdsenseConfig } from "@/lib/adsense";
import { adPageGroup, canServeAds, type AdPageGroup } from "@/lib/adsensePolicy.mjs";
import { loadAdsense, requestAdsenseSlot } from "@/lib/adsenseLoader";

export default function DisplayAd({ placement }: { placement: AdPageGroup }) {
  const config = getAdsenseConfig();
  const slotId = config.slots[placement];
  const container = useRef<HTMLElement>(null);
  const slot = useRef<HTMLModElement>(null);
  const requested = useRef(false);

  useEffect(() => {
    const config = getAdsenseConfig();
    if (!config.enabled || !config.clientId || !slotId || !container.current || !slot.current) return;
    if (!canServeAds(config, window.location) || adPageGroup(window.location.pathname) !== placement) {
      container.current.dataset.mode = "preview";
      return;
    }
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    const element = slot.current;
    const initialize = () => {
      if (cancelled || requested.current || element.getBoundingClientRect().width <= 0) return;
      requested.current = true;
      observer?.disconnect();
      try { requestAdsenseSlot(); } catch { /* 配信失敗でも本文・操作は継続する。再リクエストしない。 */ }
    };
    void loadAdsense(config.clientId).then(() => {
      if (cancelled) return;
      initialize();
      if (!requested.current && typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(initialize);
        observer.observe(element);
      }
    }).catch(() => { /* 広告ブロック・オフラインでも本文を表示する。 */ });
    return () => { cancelled = true; observer?.disconnect(); };
  }, [slotId, placement]);

  if (!config.enabled || !slotId) return null;
  return (
    <aside ref={container} className="display-ad" aria-label="広告" data-ad-placement={placement}>
      <span className="display-ad-label">広告</span>
      <div className="display-ad-space">
        <ins ref={slot} className="adsbygoogle" style={{ display: "block", width: "100%", height: 250 }}
          data-ad-client={config.clientId!} data-ad-slot={slotId} />
      </div>
    </aside>
  );
}
