"use client";
import Link from "next/link";
import { useImpressionOnce } from "@/lib/useImpression";
import { track } from "@/lib/analytics";
export default function StockpileEntry({ placement }: { placement: "hazard-map" | "area" }) {
  const ref = useImpressionOnce<HTMLParagraphElement>("stockpile_entry_view", { placement, measurement_version: "2026-10-24" });
  return <p ref={ref}><Link href={`/bousai/stockpile?from=${placement}`} onClick={() => track("stockpile_entry_click", { placement, measurement_version: "2026-10-24" })}>人数に合わせて、家庭の備蓄を確認する</Link><br /><small>水の目安と、買い足し・確認リストを作れます。</small></p>;
}
