import { describe, expect, it, vi } from "vitest";
import { rankingRestReview } from "../../../scripts/analytics/rankingRestReview";
import { buildPlan, HOST, PROPERTY, SITE, type Capture, type Snapshot } from "../../../scripts/analytics/model";
import { collect } from "../../../scripts/analytics/collect";
import { renderReport, summarize } from "../../../scripts/analytics/report";

const period = { startDate: "2026-11-01", endDate: "2026-11-14" };
function ga(dimensions: string[], metrics: string[], values: (string | number)[][]): Capture {
  return { api: "ga", period, dimensions, status: "ok", pages: [{ dimensionHeaders: dimensions.map(name => ({ name })), metricHeaders: metrics.map(name => ({ name })), rows: values.map(row => ({ dimensionValues: row.slice(0, dimensions.length).map(v => ({ value: String(v) })), metricValues: row.slice(dimensions.length).map(v => ({ value: String(v) })) })) }] };
}
const path = "/ranking/population-most/fukuoka";
function snapshot(): Snapshot { return { schemaVersion: 1, generatedAt: "2026-11-26T00:00:00Z", property: PROPERTY, host: HOST, site: SITE, plan: buildPlan("2026-11-26", "2026-11-24"), discovery: { final: {}, all: {}, gaMetadata: {} }, captures: {
  "current.ga.pages": ga(["pagePath", "deviceCategory"], ["screenPageViews", "totalUsers"], [[path, "mobile", 120, 90], [path, "desktop", 50, 40], ["/ranking/population-most/hyogo", "mobile", 999, 999]]),
} }; }
const dimensions = ["eventName", "pagePath", "deviceCategory", "customEvent:measurement_version", "customEvent:cta_variant"];
describe("順位表の続きの集計", () => {
  it("同じページ・端末・版・variantだけを使い、回数と期間人数を別々に保持する", () => {
    const s = snapshot();
    s.captures["current.ga.rankingRest"] = ga(dimensions, ["eventCount", "totalUsers"], [
      ["ranking_rest_view", path, "mobile", "ranking-rest-v1", "fukuoka-rest-baseline", 10, 7],
      ["ranking_rest_open", path, "mobile", "ranking-rest-v1", "fukuoka-rest-baseline", 13, 8],
      ["ranking_rest_view", path, "desktop", "ranking-rest-v1", "fukuoka-rest-baseline", 2, 2],
      ["ranking_rest_view", path, "mobile", "ranking-rest-v1", "fukuoka-rest-before-ad", 8, 6],
      ["ranking_rest_view", path, "mobile", "old", "fukuoka-rest-baseline", 999, 999],
      ["ranking_rest_view", "/ranking/population-most/hyogo", "mobile", "ranking-rest-v1", "fukuoka-rest-baseline", 999, 999],
    ]);
    const result = rankingRestReview(s, "current")!;
    expect(result).toHaveLength(4);
    expect(result[0]).toMatchObject({ pageUsers: 90, restRate: 7 / 90, stages: [{ count: 0, users: 0 }, { count: 13, users: 8 }, { count: 10, users: 7 }] });
    expect(result[1].stages[2].users).toBe(6);
    expect(result[2].pageUsers).toBe(40);
    expect(summarize(s).comparison.current.rankingRest).toEqual(result);
    expect(renderReport(s)).toContain("| 10 / 7 | 7.78% |");
    expect(renderReport(s)).toContain("両variantをまたぐ期間");
  });
  it("取得失敗・未取得を0件にせず、成功した空行だけ0にする", () => {
    const s = snapshot();
    expect(rankingRestReview(s, "current")![0].stages[0].users).toBeNull();
    s.captures["current.ga.rankingRest"] = ga(dimensions, ["eventCount", "totalUsers"], []);
    expect(rankingRestReview(s, "current")![0].stages[0].users).toBe(0);
    s.captures["current.ga.rankingRest"].status = "error";
    expect(rankingRestReview(s, "current")![0].restRate).toBeNull();
    delete s.captures["current.ga.pages"];
    expect(rankingRestReview(s, "current")).toBeNull();
  });
  it("専用イベントをページ・端末・版・variantで取得し、未登録定義は不明にする", async () => {
    const request = vi.fn(async (_api: string, url: string, body?: object) => {
      if (url.endsWith("/metadata")) return { dimensions: ["cta_variant", "measurement_version", "section", "metric_name", "metric_rating", "tool_source"].map(n => ({ apiName: `customEvent:${n}` })) };
      if (url.includes("searchAnalytics") && (body as { dimensions?: string[] }).dimensions?.includes("date")) return { rows: [{ keys: ["2026-11-24"], clicks: 1, impressions: 1, position: 1, ctr: 1 }] };
      return { rows: [], rowCount: 0 };
    });
    const s = await collect(request, "2026-11-26");
    expect(s.captures["current.ga.rankingRest"]).toMatchObject({ dimensions, status: "ok" });
    expect(s.captures["current.ga.rankingRest"].request).toMatchObject({ metrics: [{ name: "eventCount" }, { name: "totalUsers" }], dimensionFilter: { andGroup: { expressions: [expect.any(Object), { filter: { fieldName: "eventName", inListFilter: { values: ["ranking_rest_control_view", "ranking_rest_open", "ranking_rest_view"] } } }] } } });
    const missing = await collect(async (api, url, body) => url.endsWith("/metadata") ? { dimensions: [] } : request(api, url, body), "2026-11-26");
    expect(missing.captures["current.ga.rankingRest"].status).toBe("unavailable");
  });
});
