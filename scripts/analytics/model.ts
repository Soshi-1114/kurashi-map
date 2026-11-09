import { addDays, parseRangeArg } from "../gsc/periods";

export const PROPERTY = "542476262";
export const HOST = "kurashimap.jp";
export const SITE = "sc-domain:kurashimap.jp";
export const STUDY = {
  start: "2026-11-01", end: "2026-11-14", reviewAfter: "2026-11-17",
  baselineStart: "2026-10-17", baselineEnd: "2026-10-30",
  extendedEnd: "2026-11-28", extendedReviewAfter: "2026-12-01",
  comparableStart: "2026-10-25", publishedDay: "2026-10-31",
} as const;
export type Range = { startDate: string; endDate: string };
export type Plan = {
  requestedEnd: string | null; end: string; today: string; finalGscDate: string;
  days: number; periods: Record<string, Range>; notes: string[];
};
export type GaRow = { dimensionValues?: { value: string }[]; metricValues: { value: string }[] };
export type GaResponse = {
  dimensionHeaders?: { name: string }[]; metricHeaders?: { name: string }[];
  rows?: GaRow[]; rowCount?: number;
  metadata?: { timeZone?: string; subjectToThresholding?: boolean; dataLossFromOtherRow?: boolean; samplingMetadatas?: unknown[] };
};
export type GscRow = { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number };
export type GscResponse = { rows?: GscRow[]; metadata?: { firstIncompleteDate?: string }; responseAggregationType?: string };
export type Capture = {
  api: "ga" | "gsc"; period: Range; dimensions: string[];
  status: "ok" | "error" | "unavailable" | "truncated";
  pages: (GaResponse | GscResponse)[]; message?: string; request?: object;
};
export type Snapshot = {
  schemaVersion: 1; generatedAt: string; property: string; host: string; site: string;
  plan: Plan; discovery: { final: GscResponse; all: GscResponse; gaMetadata: unknown };
  captures: Record<string, Capture>;
};

export function validDate(date: string): string {
  parseRangeArg(`${date}..${date}`, "date");
  if (new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) throw new Error(`存在しない日付: ${date}`);
  return date;
}
export function buildPlan(today: string, finalGscDate: string, days = 28, requestedEnd?: string): Plan {
  validDate(today); validDate(finalGscDate);
  if (!Number.isInteger(days) || days < 1 || days > 90) throw new Error("--days は1〜90の整数です");
  if (requestedEnd) validDate(requestedEnd);
  const safeEnd = [addDays(today, -3), finalGscDate].sort()[0];
  const end = requestedEnd && requestedEnd < safeEnd ? requestedEnd : safeEnd;
  const range = (length: number, offset = 0): Range => ({ startDate: addDays(end, -offset - length + 1), endDate: addDays(end, -offset) });
  const periods: Record<string, Range> = { current: range(days), previous: range(days, days), current7: range(7), previous7: range(7, 7), current28: range(28), previous28: range(28, 28) };
  if (end >= STUDY.start) {
    periods.study = { startDate: STUDY.start, endDate: end < STUDY.end ? end : STUDY.end };
    periods.studyBaseline = { startDate: STUDY.baselineStart, endDate: STUDY.baselineEnd };
    periods.studyComparable = { startDate: STUDY.comparableStart, endDate: STUDY.baselineEnd };
    if (end > STUDY.end) periods.studyFollowup = { startDate: STUDY.start, endDate: end < STUDY.extendedEnd ? end : STUDY.extendedEnd };
  }
  const notes = ["GA4=Asia/Tokyo、GSC=America/Los_Angeles。両APIの値を割ったCVRは計算しない。", "GA4は本番hostName完全一致。運営者の本番操作は識別・除外できていない。"];
  if (requestedEnd && requestedEnd !== end) notes.push(`指定終端${requestedEnd}を確定・反映待ちのため${end}へ短縮。`);
  return { today, finalGscDate, days, requestedEnd: requestedEnd ?? null, end, periods, notes };
}
export type RecordRow = Record<string, string | number>;
export function records(capture?: Capture): RecordRow[] | null {
  if (!capture || capture.status !== "ok") return null;
  if (capture.api === "gsc") return capture.pages.flatMap(p => (p as GscResponse).rows ?? []).map(row => ({ ...Object.fromEntries(capture.dimensions.map((d, i) => [d, row.keys?.[i] ?? ""])), clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position }));
  return capture.pages.flatMap(p => {
    const page = p as GaResponse;
    return (page.rows ?? []).map(row => Object.fromEntries([
      ...(page.dimensionHeaders ?? []).map((d, i) => [d.name, row.dimensionValues?.[i]?.value ?? ""]),
      ...(page.metricHeaders ?? []).map((m, i) => [m.name, Number(row.metricValues[i]?.value)]),
    ]));
  });
}
export function ratio(numerator: number | null, denominator: number | null): number | null {
  return numerator === null || denominator === null || denominator <= 0 ? null : numerator / denominator;
}
export function readSnapshot(value: unknown): Snapshot {
  const s = value as Snapshot;
  if (!s || s.schemaVersion !== 1 || s.property !== PROPERTY || s.host !== HOST || s.site !== SITE || !s.plan?.periods || !s.captures || !s.discovery) throw new Error("対応していないsnapshot形式です（schemaVersion=1、本番プロパティのみ）");
  validDate(s.plan.today); validDate(s.plan.end);
  for (const range of Object.values(s.plan.periods)) parseRangeArg(`${range.startDate}..${range.endDate}`, "period");
  for (const capture of Object.values(s.captures)) {
    if (!["ga", "gsc"].includes(capture.api) || !["ok", "error", "unavailable", "truncated"].includes(capture.status) || !Array.isArray(capture.pages) || !Array.isArray(capture.dimensions)) throw new Error("capture形式が不正です");
  }
  return s;
}

export function expectedCaptureKeys(plan: Plan): string[] {
  const core = ["ga.total", "ga.events", "ga.variants", "ga.pages", "ga.channels", "ga.compareSource", "ga.compareDevice", "ga.compareCta", "gsc.total", "gsc.page", "gsc.device", "gsc.query"];
  return Object.keys(plan.periods).flatMap(p => (p.startsWith("study") ? core.slice(0, 3) : core).map(key => `${p}.${key}`));
}
