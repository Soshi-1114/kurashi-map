"use client";

import NextLink from "next/link";
import type { ComponentProps } from "react";
import { getAdsenseConfig, navigateDocument } from "@/lib/adsense";
import { requiresDocumentNavigation } from "@/lib/adsensePolicy.mjs";

// 広告の読み込まれた document と CSP を操作画面へ引き継がない。
// onNavigate は onClick の後に発火するので既存の計測・比較候補操作も維持する。
export default function SiteLink({ onNavigate, prefetch, ...props }: ComponentProps<typeof NextLink>) {
  const config = getAdsenseConfig();
  return <NextLink {...props} prefetch={config.enabled ? false : prefetch} onNavigate={(event) => {
    let prevented = false;
    onNavigate?.({ ...event, preventDefault() { prevented = true; event.preventDefault(); } });
    if (prevented || !config.enabled) return;
    const href = props.as ?? props.href;
    // 現行サイトの内部リンクは文字列。外部URL・アンカー・新規タブは Next の動作を保つ。
    if (typeof href !== "string") return;
    const current = new URL(window.location.href);
    const destination = new URL(href, current);
    if (requiresDocumentNavigation(config, current, destination)) {
      event.preventDefault();
      navigateDocument(destination.href, props.replace);
    }
  }} />;
}
