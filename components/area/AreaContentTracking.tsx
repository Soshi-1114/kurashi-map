"use client";

import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics";

export const AREA_CONTENT_MEASUREMENT_VERSION = "2026-11-20";
const SECTIONS = ["overview", "insights", "data", "compare", "ranking", "details"] as const;

/** 本文の見出しへの到達。広告の表示・配信・Active View は計測しない。 */
export default function AreaContentTracking({ municipalityCode }: { municipalityCode: string }) {
  const sent = useRef(new Set<string>());

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const targets = new Map<Element, string>();
    for (const section of SECTIONS) {
      const heading = document.getElementById(section)?.querySelector("h1, h2");
      if (heading) targets.set(heading, section);
    }
    const observer = new IntersectionObserver(entries => {
      if (document.visibilityState !== "visible" || typeof window.gtag !== "function") return;
      for (const entry of entries) {
        const section = targets.get(entry.target);
        if (!section || sent.current.has(`${municipalityCode}:${section}`) || !entry.isIntersecting || entry.intersectionRatio < 0.5) continue;
        sent.current.add(`${municipalityCode}:${section}`);
        track("area_section_view", {
          section,
          municipality_code: municipalityCode,
          measurement_version: AREA_CONTENT_MEASUREMENT_VERSION,
        });
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.5 });
    // タブが隠れたまま読み込まれた場合は、表示時に現在の見出しを改めて観測する。
    const observe = () => {
      if (document.visibilityState !== "visible") return;
      for (const [heading, section] of targets) {
        if (!sent.current.has(`${municipalityCode}:${section}`)) { observer.unobserve(heading); observer.observe(heading); }
      }
    };
    observe();
    document.addEventListener("visibilitychange", observe);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", observe); };
  }, [municipalityCode]);

  return null;
}
