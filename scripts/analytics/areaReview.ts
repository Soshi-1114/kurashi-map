import { records, type Snapshot } from "./model";

export const AREA_SECTIONS = ["overview", "insights", "data", "compare", "ranking", "details"] as const;
const municipality = (path: unknown) => /^\/area\/[a-z-]+\/\d{5}\/?$/.test(String(path));

export function areaReach(s: Snapshot, period: string) {
  const audience = records(s.captures[`${period}.ga.pages`]);
  const sections = records(s.captures[`${period}.ga.areaSections`]);
  if (audience === null) return null;
  return audience.filter(r => municipality(r.pagePath)).sort((a, b) => Number(b.screenPageViews) - Number(a.screenPageViews)).slice(0, 15).map(row => ({
    path: row.pagePath, device: row.deviceCategory, views: row.screenPageViews, users: row.totalUsers,
    // 人数をページ・端末・見出し間で足さない。GA4が各組合せで返した期間人数を保持する。
    sections: AREA_SECTIONS.map(section => sections === null ? null : sections.find(r => r.pagePath === row.pagePath && r.deviceCategory === row.deviceCategory && r["customEvent:section"] === section && r["customEvent:measurement_version"] === "2026-11-20")?.totalUsers ?? 0),
  }));
}

export function areaVitals(s: Snapshot, period: string) {
  const rows = records(s.captures[`${period}.ga.vitals`]);
  if (rows === null) return null;
  const grouped = new Map<string, { device: string; metric: string; version: string; good: number; needs: number; poor: number; unknown: number }>();
  for (const row of rows) {
    const metric = String(row["customEvent:metric_name"]);
    if (!municipality(row.pagePath) || !["CLS", "LCP", "INP"].includes(metric)) continue;
    const device = String(row.deviceCategory);
    const version = String(row["customEvent:measurement_version"] ?? "(not set)");
    const key = JSON.stringify([device, metric, version]);
    const item = grouped.get(key) ?? { device, metric, version, good: 0, needs: 0, poor: 0, unknown: 0 };
    const rating = row["customEvent:metric_rating"];
    const bucket = rating === "good" ? "good" : rating === "needs-improvement" ? "needs" : rating === "poor" ? "poor" : "unknown";
    item[bucket] += Number(row.eventCount);
    grouped.set(key, item);
  }
  return [...grouped.values()].sort((a, b) => a.device.localeCompare(b.device) || a.metric.localeCompare(b.metric));
}
