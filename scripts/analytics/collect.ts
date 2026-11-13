import { addDays } from "../gsc/periods";
import { captureReport, GA_ENDPOINT, GSC_ENDPOINT, type Request, type Spec } from "./api";
import { buildPlan, HOST, PROPERTY, SITE, type Capture, type GscResponse, type Snapshot } from "./model";

export const COMPARE_EVENTS = ["tool_entry", "compare_ready", "compare_view", "compare_candidate_add", "compare_candidate_start", "compare_cta_view", "compare_cta_click"];
const TOOL_EVENTS = [...COMPARE_EVENTS, "shindan_run", "shindan_result_scroll", "shindan_result_click", "shindan_compare_click", "shindan_compare_top_click", "denki_entry_view", "denki_quick_interact", "denki_quick_result_view", "stockpile_entry_view", "stockpile_quick_interact", "stockpile_quick_result_view", "stockpile_start", "stockpile_list_view"];
export async function collect(request: Request, today: string, days = 28, end?: string, progress: (key: string) => void = () => {}): Promise<Snapshot> {
  const probeRange = { startDate: addDays(today, -14), endDate: addDays(today, -1) };
  const [final, all, gaMetadata] = await Promise.all([
    request("gsc", GSC_ENDPOINT, { ...probeRange, dimensions: ["date"], type: "web", dataState: "final", rowLimit: 25000 }) as Promise<GscResponse>,
    request("gsc", GSC_ENDPOINT, { ...probeRange, dimensions: ["date"], type: "web", dataState: "all", rowLimit: 25000 }) as Promise<GscResponse>,
    request("ga", GA_ENDPOINT + "/metadata"),
  ]);
  const dates = (final.rows ?? []).map(row => row.keys?.[0]).filter((d): d is string => !!d).sort();
  if (!dates.length) throw new Error("GSC確定終端を確認できません。推測した期間では集計しません。");
  const plan = buildPlan(today, dates.at(-1)!, days, end);
  const snapshot: Snapshot = { schemaVersion: 1, generatedAt: new Date().toISOString(), property: PROPERTY, host: HOST, site: SITE, plan, discovery: { final, all, gaMetadata }, captures: {} };
  const custom = new Set((gaMetadata as { dimensions?: { apiName: string }[] }).dimensions?.map(d => d.apiName));
  const jobs: [string, Spec][] = [];
  for (const [name, period] of Object.entries(plan.periods)) {
    const ga = (key: string, dimensions: string[], metrics: string[], events?: string[]) => jobs.push([`${name}.ga.${key}`, { api: "ga", period, dimensions, metrics, events }]);
    ga("total", [], ["activeUsers", "totalUsers", "newUsers", "sessions", "engagedSessions", "engagementRate", "screenPageViews", "userEngagementDuration"]);
    ga("events", ["eventName"], ["eventCount", "totalUsers"]);
    ga("variants", ["eventName", "customEvent:cta_variant", "customEvent:measurement_version"], ["eventCount", "totalUsers"], TOOL_EVENTS);
    if (name.startsWith("study")) continue;
    ga("pages", ["pagePath", "deviceCategory"], ["screenPageViews"]);
    ga("compareOrigins", ["pagePath"], ["totalUsers", "screenPageViews"], ["page_view"]);
    ga("channels", ["sessionDefaultChannelGroup"], ["sessions", "activeUsers"]);
    ga("compareSource", ["eventName", "customEvent:tool_source", "deviceCategory"], ["eventCount", "totalUsers"], COMPARE_EVENTS);
    ga("compareDevice", ["eventName", "deviceCategory"], ["eventCount", "totalUsers"], COMPARE_EVENTS);
    ga("compareCta", ["eventName", "pagePath", "deviceCategory"], ["eventCount", "totalUsers"], ["compare_cta_view", "compare_cta_click"]);
    for (const dimensions of [[], ["page"], ["device"], ["query"]]) jobs.push([`${name}.gsc.${dimensions[0] ?? "total"}`, { api: "gsc", period, dimensions }]);
  }
  // current/current28 等が同じ期間ならリクエストを共有。期間ユーザーは返却された値を使用する。
  const cache = new Map<string, Promise<Capture>>();
  for (let i = 0; i < jobs.length; i += 3) {
    await Promise.all(jobs.slice(i, i + 3).map(async ([key, spec]) => {
      const missing = spec.dimensions.filter(d => d.startsWith("customEvent:") && !custom.has(d));
      if (missing.length) snapshot.captures[key] = { api: spec.api, period: spec.period, dimensions: spec.dimensions, status: "unavailable", pages: [], message: `カスタム定義不足: ${missing.join(", ")}` };
      else {
        const signature = JSON.stringify(spec);
        if (!cache.has(signature)) cache.set(signature, captureReport(request, spec));
        snapshot.captures[key] = await cache.get(signature)!;
      }
      progress(`${key}: ${snapshot.captures[key].status}`);
    }));
  }
  return snapshot;
}
