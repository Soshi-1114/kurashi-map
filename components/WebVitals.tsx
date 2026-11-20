"use client";

import { useReportWebVitals } from "next/web-vitals";
import { track } from "@/lib/analytics";

// Core Web Vitals（LCP / INP / CLS / FCP / TTFB）を GA4 のカスタムイベントとして送る。
// next/web-vitals は web-vitals を内蔵しており追加依存は不要。レンダリングは行わない。
//
// 値は GA4 側で扱いやすいよう整数化する（CLS のみ小数なので 1000 倍してミリ単位相当に）。
// metric_rating（good/needs-improvement/poor）も併せて送り、しきい値判定を GA4 上で再計算せずに済むようにする。
// 参照を固定する。再レンダーで新しい関数を渡すと既存の測定値が再通知される。
const reportWebVitals: Parameters<typeof useReportWebVitals>[0] = (metric) => {
  track("web_vitals", {
    metric_name: metric.name,
    metric_id: metric.id,
    metric_rating: metric.rating,
    measurement_version: "2026-11-20",
    // CLS は無次元のスコアなので桁を保つため 1000 倍。それ以外（ms）は四捨五入。
    value: Math.round(metric.name === "CLS" ? metric.value * 1000 : metric.value),
    non_interaction: true,
  });
};

export default function WebVitals() {
  useReportWebVitals(reportWebVitals);
  return null;
}
