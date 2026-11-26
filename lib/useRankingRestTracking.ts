"use client";

import { useCallback, useEffect, useRef, type MouseEvent } from "react";
import { track } from "./analytics";
import { isRankingRestTarget, RANKING_REST_VERSION, type RankingRestEvent, type RankingRestVariant } from "./rankingRest";

/** 広告は観測せず、続きの操作・11件目の実際の視認を別々に記録する。 */
export function useRankingRestTracking(metric: string, pref: string | undefined, query: string, variant: RankingRestVariant = "fukuoka-rest-baseline") {
  const details = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);
  const firstRow = useRef<HTMLTableRowElement>(null);
  // details自体は検索で再マウントされるが、送信済み状態は文書内で保持する。
  const sent = useRef(new Set<RankingRestEvent>());
  const userOpening = useRef(false);
  const enabled = isRankingRestTarget(metric, pref) && query === "";

  const send = useCallback((event: RankingRestEvent) => {
    if (!enabled || document.visibilityState !== "visible" || typeof window.gtag !== "function" || sent.current.has(event)) return;
    track(event, { metric_key: "population-most", section: "rest", measurement_version: RANKING_REST_VERSION, cta_variant: variant });
    sent.current.add(event);
  }, [enabled, variant]);

  const onSummaryClick = useCallback((event: MouseEvent<HTMLElement>) => {
    // summaryのネイティブなEnter/Space操作もclickになる。openの自動復元は含めない。
    userOpening.current = enabled && !event.defaultPrevented && event.button === 0 && !details.current?.open;
  }, [enabled]);
  const onToggle = useCallback(() => {
    if (details.current?.open && userOpening.current) send("ranking_rest_open");
    userOpening.current = false;
  }, [send]);

  useEffect(() => {
    userOpening.current = false;
    if (!enabled || typeof IntersectionObserver === "undefined") return;
    const targets = new Map<Element, RankingRestEvent>();
    if (summary.current) targets.set(summary.current, "ranking_rest_control_view");
    if (firstRow.current) targets.set(firstRow.current, "ranking_rest_view");
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const event = targets.get(entry.target);
        if (!event || !entry.isIntersecting || entry.intersectionRatio < 0.5) continue;
        if (event === "ranking_rest_view" && !details.current?.open) continue;
        send(event);
        if (sent.current.has(event)) observer.unobserve(entry.target);
      }
    }, { threshold: 0.5 });
    const observe = () => {
      if (document.visibilityState !== "visible") return;
      for (const [target, event] of targets) {
        if (!sent.current.has(event)) { observer.unobserve(target); observer.observe(target); }
      }
    };
    observe();
    document.addEventListener("visibilitychange", observe);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", observe); };
  }, [enabled, query, send]);

  return { details, summary, firstRow, onSummaryClick, onToggle };
}
