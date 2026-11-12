"use client";

import Link from "@/components/SiteLink";
import { Scale } from "lucide-react";
import { ANALYTICS_MEASUREMENT_VERSION, compareAttributionParams, track } from "@/lib/analytics";
import type { CompareAttribution } from "@/lib/siteNav";
import { useImpressionOnce } from "@/lib/useImpression";

/** 比較導線の視認・クリックを、実験対象ページだけで計測する。 */
export default function TrackedCompareLink({
  href,
  count,
  attribution,
  label,
  className = "rk-action rk-action-ghost",
}: {
  href: string;
  count: number;
  attribution: CompareAttribution;
  label?: string;
  className?: string;
}) {
  const params = {
    ...compareAttributionParams(attribution),
    page_path: attribution.originPath,
    tool_source: "pref_ranking_top3",
    measurement_version: ANALYTICS_MEASUREMENT_VERSION,
  };

  const linkRef = useImpressionOnce<HTMLAnchorElement>("compare_cta_view", params);

  return (
    <Link
      ref={linkRef}
      href={href}
      className={className}
      onClick={() => track("compare_cta_click", params)}
    >
      <Scale size={15} aria-hidden="true" />{label ?? `上位${count}件を比較する`}
    </Link>
  );
}
