import { describe, expect, it, vi } from "vitest";
import { buildPlan, HOST, PROPERTY, SITE, records, readSnapshot, ratio, type Capture, type Snapshot } from "../../../scripts/analytics/model";
import { captureReport, requestBody, type Request } from "../../../scripts/analytics/api";
import { collect } from "../../../scripts/analytics/collect";
import { renderReport, studySummary, sumGroups, summarize } from "../../../scripts/analytics/report";
import { parseArgs } from "../../../scripts/analytics/reportCli";

const period = { startDate: "2026-11-01", endDate: "2026-11-03" };
function ga(dimensions: string[], metrics: string[], values: (string | number)[][]): Capture {
  return { api: "ga", period, dimensions, status: "ok", pages: [{ dimensionHeaders: dimensions.map(name => ({ name })), metricHeaders: metrics.map(name => ({ name })), rows: values.map(row => ({ dimensionValues: row.slice(0, dimensions.length).map(value => ({ value: String(value) })), metricValues: row.slice(dimensions.length).map(value => ({ value: String(value) })) })) }] };
}
function snapshot(): Snapshot {
  return { schemaVersion: 1, generatedAt: "2026-11-06T00:00:00Z", property: PROPERTY, host: HOST, site: SITE, plan: buildPlan("2026-11-06", "2026-11-04"), discovery: { final: {}, all: {}, gaMetadata: {} }, captures: {} };
}
describe("分析条件", () => {
  it("JST日付から3日前とGSC確定終端の早い方を採用し、曜日の揃う期間を作る", () => {
    const p = buildPlan("2026-11-06", "2026-11-04");
    expect(p.end).toBe("2026-11-03");
    expect(p.periods.current28).toEqual({ startDate: "2026-10-07", endDate: "2026-11-03" });
    expect(p.periods.previous28).toEqual({ startDate: "2026-09-09", endDate: "2026-10-06" });
    expect(buildPlan("2026-11-06", "2026-11-02").end).toBe("2026-11-02");
    expect(buildPlan("2026-11-06", "2026-11-04", 7, "2026-11-05").notes.join()).toContain("短縮");
    expect(buildPlan("2026-03-02", "2026-02-27").periods.current7.startDate).toBe("2026-02-21");
  });
  it("不正日付・引数と再生成時の条件書き換えを拒否する", () => {
    expect(() => buildPlan("2026-11-06", "2026-11-03", 0)).toThrow();
    expect(() => parseArgs(["--end=2026-02-30"])).toThrow();
    expect(() => parseArgs(["--input=a.json", "--end=2026-11-03"])).toThrow();
    expect(() => parseArgs(["--unknown=x"])).toThrow();
    expect(() => readSnapshot({})).toThrow();
    expect(() => readSnapshot({ ...snapshot(), host: "localhost" })).toThrow();
  });
  it("GAは本番host完全一致、GSCはfinalに固定する", () => {
    const body = requestBody({ api: "ga", period, dimensions: ["eventName"], metrics: ["eventCount"], events: ["compare_view"] }, 0);
    expect(body).toMatchObject({ dimensionFilter: { andGroup: { expressions: [{ filter: { fieldName: "hostName", stringFilter: { matchType: "EXACT", value: HOST } } }, { filter: { fieldName: "eventName", inListFilter: { values: ["compare_view"] } } }] } } });
    expect(requestBody({ api: "gsc", period, dimensions: ["page"] }, 25000)).toMatchObject({ dataState: "final", startRow: 25000 });
  });
});
describe("取得の完全性", () => {
  it("GAのrowCountを使って全ページ取得し、重複ユーザーは合算しない", async () => {
    const page = { dimensionHeaders: [{ name: "eventName" }], metricHeaders: [{ name: "eventCount" }], rows: Array.from({ length: 100000 }, () => ({ dimensionValues: [{ value: "a" }], metricValues: [{ value: "1" }] })), rowCount: 100001 };
    const request = vi.fn().mockResolvedValueOnce(page).mockResolvedValueOnce({ ...page, rows: [{ dimensionValues: [{ value: "b" }], metricValues: [{ value: "1" }] }] });
    const c = await captureReport(request, { api: "ga", period, dimensions: ["eventName"], metrics: ["eventCount"] });
    expect(c.status).toBe("ok"); expect(records(c)).toHaveLength(100001);
    expect(request.mock.calls[1][2]).toMatchObject({ offset: 100000 });
  });
  it("GSCのページング、途中エラー、上限到達を区別する", async () => {
    const full = { rows: Array.from({ length: 25000 }, () => ({ clicks: 1, impressions: 1, ctr: 1, position: 1 })) };
    const spec = { api: "gsc" as const, period, dimensions: ["page"] };
    const request = vi.fn().mockResolvedValueOnce(full).mockResolvedValueOnce({ rows: [] });
    expect((await captureReport(request, spec)).status).toBe("ok");
    expect(request.mock.calls[1][2]).toMatchObject({ startRow: 25000 });
    expect((await captureReport(vi.fn().mockResolvedValue(full), spec, 1)).status).toBe("truncated");
    const broken = await captureReport(vi.fn().mockResolvedValueOnce(full).mockRejectedValueOnce(new Error("HTTP 403")), spec);
    expect(broken.status).toBe("error"); expect(records(broken)).toBeNull();
  });
  it("定義不足を0件にせず、同一期間の要求を共有する", async () => {
    const request: Request = vi.fn(async (_api, url, body) => {
      if (url.endsWith("/metadata")) return { dimensions: [] };
      if (url.includes("searchAnalytics") && (body as { dimensions: string[] }).dimensions.includes("date")) return { rows: [{ keys: ["2026-11-03"], clicks: 1, impressions: 10, ctr: .1, position: 3 }] };
      return { rows: [], rowCount: 0 };
    });
    const s = await collect(request, "2026-11-06");
    expect(s.captures["current7.ga.variants"].status).toBe("unavailable");
    expect(records(s.captures["current7.ga.variants"])).toBeNull();
    expect(s.captures["current.ga.total"]).toBe(s.captures["current28.ga.total"]);
    expect(summarize(s).complete).toBe(false);
  });
});
describe("評価とレポート", () => {
  it("人口導線はページ固有variantと定義版を一致させ、入口人数を別取得する", () => {
    const s = snapshot();
    s.captures["current7.ga.compareOrigins"] = ga(["pagePath"], ["totalUsers", "screenPageViews"], [["/ranking/population-most/hokkaido", 100, 120]]);
    const variant = "population-compare-2026-11:hokkaido:treatment";
    s.captures["current7.ga.variants"] = ga(["eventName", "customEvent:cta_variant", "customEvent:measurement_version"], ["eventCount", "totalUsers"], [
      ["compare_cta_view", variant, "2026-10-09", 25, 20],
      ["compare_cta_click", variant, "2026-10-09", 3, 3],
      ["tool_entry", variant, "2026-10-09", 3, 3],
      ["compare_ready", variant, "2026-10-09", 3, 3],
      ["compare_view", variant, "2026-10-09", 3, 2],
      ["compare_view", variant, "wrong-version", 99, 99],
    ]);
    expect(renderReport(s)).toContain("| /ranking/population-most/hokkaido | 100 | 20 | 3 | 3 | 3 | 2 | 2.00% |");
  });
  it("旧版と新版を混ぜず、公開当日を除き、期間ユーザーを使用する", () => {
    const s = snapshot();
    expect(s.plan.periods.study).toEqual(period);
    s.captures["study.ga.variants"] = ga(["eventName", "customEvent:cta_variant", "customEvent:measurement_version"], ["eventCount", "totalUsers"], [
      ["denki_entry_view", "estimate-v1", "2026-10-24", 900, 800],
      ["denki_entry_view", "inline-v1", "2026-10-31", 256, 137],
      ["denki_quick_result_view", "inline-v1", "2026-10-31", 3, 2],
      ["denki_quick_result_view", "inline-v1", "2026-10-24", 50, 50],
    ]);
    const d = studySummary(s).rows[0];
    expect(d.views).toBe(256); expect(d.resultUsers).toBe(2); expect(d.resultRate).toBe(2 / 137); expect(d.state).toContain("中間");
    s.plan = buildPlan("2026-11-17", "2026-11-14");
    expect(studySummary(s).rows[0].state).toContain("500視認未満");
    expect(studySummary(s).rows[1].resultRate).toBeNull(); // 分母0は0%にしない
  });
  it("欠損は不明、成功した空のイベント一覧は0とする", () => {
    const s = snapshot();
    expect(studySummary(s).rows[0].views).toBeNull();
    s.captures["study.ga.variants"] = ga([], [], []);
    expect(studySummary(s).rows[0].views).toBe(0);
    expect(ratio(0, 0)).toBeNull(); expect(ratio(1, null)).toBeNull();
    const report = renderReport(s);
    expect(report).toContain("運営者"); expect(report).toContain("#242の公開は自動判定しない");
    expect(report).not.toContain("NaN"); expect(report).not.toContain("Infinity");
  });
  it("PVだけをページ群で合計し、ユーザーは行別のまま保持する", () => {
    expect(sumGroups([{ pagePath: "/ranking/a", screenPageViews: 3, totalUsers: 2 }, { pagePath: "/ranking/b", screenPageViews: 4, totalUsers: 2 }], "pagePath", "screenPageViews")).toEqual({ ランキング: 7 });
    const s = snapshot();
    s.captures["current7.ga.compareSource"] = ga(["eventName", "customEvent:tool_source", "deviceCategory"], ["eventCount", "totalUsers"], [["compare_view", "ranking", "mobile", 3, 2], ["compare_view", "ranking_top3", "mobile", 4, 2]]);
    expect(summarize(s).comparison.current7.sourceAndDevice?.map(r => r.totalUsers)).toEqual([2, 2]);
  });
  it("28日追加観測を14日評価と分け、母数不足を判断保留にする", () => {
    const s = snapshot();
    s.plan = buildPlan("2026-12-01", "2026-11-28");
    expect(s.plan.periods.study.endDate).toBe("2026-11-14");
    expect(s.plan.periods.studyFollowup).toEqual({ startDate: "2026-11-01", endDate: "2026-11-28" });
    s.captures["studyFollowup.ga.variants"] = ga(["eventName", "customEvent:cta_variant", "customEvent:measurement_version"], ["eventCount", "totalUsers"], [["denki_entry_view", "inline-v1", "2026-10-31", 400, 200], ["denki_quick_result_view", "inline-v1", "2026-10-31", 10, 10]]);
    expect(studySummary(s, "studyFollowup").rows[0].state).toContain("28日終了・母数不足");
    expect(renderReport(s)).toContain("28日までの追加観測");
  });
  it("未保存リクエストを取得完了としない", () => {
    expect(summarize(snapshot()).issues.join()).toContain("current.ga.total: 未保存");
    expect(renderReport(snapshot())).not.toContain("全リクエスト取得完了");
  });
  it("保存データの再読込で同一レポートを作り、品質通知を保持する", () => {
    const s = snapshot();
    s.captures["current7.ga.total"] = ga([], ["totalUsers"], [[10]]);
    s.captures["current7.ga.total"].pages[0].metadata = { subjectToThresholding: true, timeZone: "UTC" };
    const replay = readSnapshot(JSON.parse(JSON.stringify(s)));
    expect(renderReport(replay)).toBe(renderReport(s));
    expect(summarize(replay).issues.join()).toContain("閾値");
    expect(summarize(replay).issues.join()).toContain("timezone");
  });
});
