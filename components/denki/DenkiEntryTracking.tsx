"use client";
import type { ReactNode } from "react";
import { track } from "@/lib/analytics";
import { useImpressionOnce } from "@/lib/useImpression";

/** 本文・エリア解決はサーバー側に保ち、入口の視認とクリックだけを計測する。 */
export default function DenkiEntryTracking({ municipalityCode, area, children }: {
  municipalityCode: string;
  area: string;
  children: ReactNode;
}) {
  const params = { placement: "area-overview", municipality_code: municipalityCode, area, cta_variant: "estimate-v1", measurement_version: "2026-10-24" };
  const ref = useImpressionOnce<HTMLDivElement>("denki_entry_view", params);
  return <div ref={ref} onClickCapture={event => {
    if (event.target instanceof Element && event.target.closest("a[data-denki-entry]")) track("denki_entry_click", params);
  }}>{children}</div>;
}
