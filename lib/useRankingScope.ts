"use client";
import { useSyncExternalStore } from "react";
import { parseRankingScope } from "./rankingScope";

const subscribe = (fn: () => void) => {
  window.addEventListener("popstate", fn);
  return () => window.removeEventListener("popstate", fn);
};

export function useRankingScope(initialPref?: string) {
  return useSyncExternalStore(subscribe, () => {
    if (initialPref) return parseRankingScope(null, initialPref);
    const region = new URLSearchParams(window.location.search).get("region");
    return parseRankingScope(region ? `region:${region}` : null, initialPref);
  }, () => parseRankingScope(null, initialPref));
}
