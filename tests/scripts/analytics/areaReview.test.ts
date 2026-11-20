import { describe, expect, it } from "vitest";
import { areaReach, areaVitals } from "../../../scripts/analytics/areaReview";
import { buildPlan, HOST, PROPERTY, SITE, type Capture, type Snapshot } from "../../../scripts/analytics/model";

function ga(dimensions: string[], metrics: string[], values: (string | number)[][]): Capture {
  return { api: "ga", status: "ok", period: { startDate: "2026-11-01", endDate: "2026-11-14" }, dimensions, pages: [{
    dimensionHeaders: dimensions.map(name => ({ name })), metricHeaders: metrics.map(name => ({ name })),
    rows: values.map(row => ({ dimensionValues: row.slice(0, dimensions.length).map(value => ({ value: String(value) })), metricValues: row.slice(dimensions.length).map(value => ({ value: String(value) })) })),
  }] };
}
function snapshot(): Snapshot {
  return { schemaVersion: 1, generatedAt: "2026-11-20T00:00:00Z", property: PROPERTY, host: HOST, site: SITE, plan: buildPlan("2026-11-20", "2026-11-17"), discovery: { final: {}, all: {}, gaMetadata: {} }, captures: {} };
}
describe("自治体詳細の計測レビュー", () => {
  it("端末・ページ間の人数を足さず、新版の見出しだけを照合する", () => {
    const s = snapshot();
    s.captures["current.ga.pages"] = ga(["pagePath", "deviceCategory"], ["screenPageViews", "totalUsers"], [
      ["/area/tokyo/13101", "mobile", 100, 50], ["/area/tokyo/13101", "desktop", 80, 40], ["/area/tokyo", "mobile", 200, 60],
    ]);
    s.captures["current.ga.areaSections"] = ga(["pagePath", "deviceCategory", "customEvent:section", "customEvent:measurement_version"], ["eventCount", "totalUsers"], [
      ["/area/tokyo/13101", "mobile", "data", "old", 999, 999],
      ["/area/tokyo/13101", "mobile", "data", "2026-11-20", 8, 5],
      ["/area/tokyo/13101", "desktop", "data", "2026-11-20", 6, 4],
    ]);
    const rows = areaReach(s, "current")!;
    expect(rows).toHaveLength(2);
    expect(rows.map(r => r.users)).toEqual([50, 40]);
    expect(rows.map(r => r.sections[2])).toEqual([5, 4]);
    expect(rows.map(r => r.sections[0])).toEqual([0, 0]);
    s.captures["current.ga.areaSections"].status = "error";
    expect(areaReach(s, "current")![0].sections).toEqual([null, null, null, null, null, null]);
  });
  it("Web Vitalsは版と端末別にイベントだけを合算し、不明の判定を捨てない", () => {
    const s = snapshot();
    s.captures["current.ga.vitals"] = ga(["pagePath", "deviceCategory", "customEvent:metric_name", "customEvent:metric_rating", "customEvent:measurement_version"], ["eventCount"], [
      ["/area/tokyo/13101", "mobile", "CLS", "good", "2026-11-20", 5],
      ["/area/tokyo/13102", "mobile", "CLS", "good", "2026-11-20", 4],
      ["/area/tokyo/13102", "mobile", "CLS", "(not set)", "2026-11-20", 2],
      ["/area/tokyo/13102", "mobile", "CLS", "poor", "(not set)", 3],
      ["/area/tokyo", "mobile", "CLS", "poor", "2026-11-20", 99],
    ]);
    expect(areaVitals(s, "current")).toEqual([
      { device: "mobile", metric: "CLS", version: "2026-11-20", good: 9, needs: 0, poor: 0, unknown: 2 },
      { device: "mobile", metric: "CLS", version: "(not set)", good: 0, needs: 0, poor: 3, unknown: 0 },
    ]);
    expect(areaVitals(s, "previous")).toBeNull();
  });
});
