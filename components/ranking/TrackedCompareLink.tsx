"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Scale } from "lucide-react";
import { ANALYTICS_MEASUREMENT_VERSION, track } from "@/lib/analytics";

/** 比較導線の変更前基準値を、実験対象ページだけで計測する。 */
export default function TrackedCompareLink({
  href,
  count,
  pagePath,
}: {
  href: string;
  count: number;
  pagePath: string;
}) {
  const linkRef = useRef<HTMLAnchorElement | null>(null);
  const seen = useRef(false);
  const params = {
    experiment_id: "compare-link-2026-09",
    variant: "baseline",
    page_path: pagePath,
    tool_source: "pref_ranking_top3",
    measurement_version: ANALYTICS_MEASUREMENT_VERSION,
  };

  useEffect(() => {
    const node = linkRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || seen.current) return;
      seen.current = true;
      track("compare_cta_view", params);
      observer.disconnect();
    }, { threshold: 0.5 });
    observer.observe(node);
    return () => observer.disconnect();
    // 対象ページの静的パラメータはマウント中に変化しない。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Link
      ref={linkRef}
      href={href}
      className="rk-action rk-action-ghost"
      onClick={() => track("compare_cta_click", params)}
    >
      <Scale size={15} aria-hidden="true" />上位{count}件を比較する
    </Link>
  );
}
