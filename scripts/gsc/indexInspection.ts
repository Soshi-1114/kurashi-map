// URL Inspection API の索引済み状態を記録する。ライブURLの登録可否は返さない。
import fs from "node:fs";
import path from "node:path";
import { getAccessToken } from "./auth";

export type InspectionRecord = {
  url: string;
  checkedAt: string;
  verdict?: string;
  coverageState?: string;
  robots?: string;
  fetch?: string;
  indexing?: string;
  lastCrawlTime?: string;
  userCanonical?: string;
  googleCanonical?: string;
  error?: string;
};

export function readCohort(file: string, site: string): string[] {
  const origin = new URL(site).origin;
  const rows = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/);
  const urls = rows.slice(1).filter(Boolean).map((line) => line.split(",", 1)[0]);
  if (urls.some((url) => new URL(url).origin !== origin)) throw new Error("cohort に別originのURLがあります");
  return [...new Set(urls)];
}

export function readRecords(file: string): InspectionRecord[] {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as InspectionRecord);
}

export function summarize(records: InspectionRecord[]): Record<string, number> {
  const latest = new Map<string, InspectionRecord>();
  for (const record of records) latest.set(record.url, record);
  const counts: Record<string, number> = {};
  for (const record of latest.values()) {
    const state = record.error ? "error" : `${record.verdict ?? "unknown"}: ${record.coverageState ?? "unknown"}`;
    counts[state] = (counts[state] ?? 0) + 1;
  }
  return counts;
}

export async function inspectUrl(url: string, siteUrl: string, token: string,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<InspectionRecord> {
  const checkedAt = new Date().toISOString();
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ inspectionUrl: url, siteUrl, languageCode: "ja-JP" }),
        signal: AbortSignal.timeout(30_000),
      });
      if ((response.status === 429 || response.status >= 500) && attempt < 3) {
        await wait(1000 * 2 ** attempt);
        continue;
      }
      if (!response.ok) return { url, checkedAt, error: `HTTP ${response.status}` };
      const result = (await response.json() as { inspectionResult?: { indexStatusResult?: Record<string, string> } })
        .inspectionResult?.indexStatusResult;
      if (!result) return { url, checkedAt, error: "missing indexStatusResult" };
      return {
        url, checkedAt,
        verdict: result.verdict,
        coverageState: result.coverageState,
        robots: result.robotsTxtState,
        fetch: result.pageFetchState,
        indexing: result.indexingState,
        lastCrawlTime: result.lastCrawlTime,
        userCanonical: result.userCanonical,
        googleCanonical: result.googleCanonical,
      };
    } catch (error) {
      if (attempt === 3) return { url, checkedAt, error: error instanceof Error ? error.message : String(error) };
      await wait(1000 * 2 ** attempt);
    }
  }
  return { url, checkedAt, error: "retry exhausted" };
}

async function main() {
  const args = new Map(process.argv.slice(2).map((arg) => {
    const [key, ...value] = arg.replace(/^--/, "").split("=");
    return [key, value.join("=")];
  }));
  const siteUrl = args.get("site") ?? "sc-domain:kurashimap.jp";
  const input = args.get("input") ?? "docs/seo/index-audit-2026-10-11.csv";
  const output = args.get("output") ?? `reports/gsc/index-monitor/${new Date().toISOString().slice(0, 10)}.jsonl`;
  const limit = Number(args.get("limit") ?? "370");
  if (!Number.isInteger(limit) || limit < 1 || limit > 2000) throw new Error("limit は1〜2000を指定してください");
  const siteOrigin = siteUrl.startsWith("sc-domain:") ? `https://${siteUrl.slice(10)}` : siteUrl;
  const cohort = readCohort(input, siteOrigin).slice(0, limit);
  const previous = readRecords(output);
  const completed = new Set(previous.filter((r) => !r.error).map((r) => r.url));
  const pending = cohort.filter((url) => !completed.has(url));
  const token = pending.length ? await getAccessToken() : "";
  fs.mkdirSync(path.dirname(output), { recursive: true });
  for (const [index, url] of pending.entries()) {
    const record = await inspectUrl(url, siteUrl, token);
    fs.appendFileSync(output, `${JSON.stringify(record)}\n`);
    if (record.error === "HTTP 429") {
      process.stderr.write("quota/rate limit: stopped; remaining URLs can be resumed later\n");
      process.exitCode = 1;
      break;
    }
    if ((index + 1) % 25 === 0) process.stdout.write(`inspected ${index + 1}/${pending.length}\n`);
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  process.stdout.write(`${JSON.stringify(summarize(readRecords(output)), null, 2)}\n`);
}

if (process.argv[1] && /indexInspection\.[cm]?[jt]s$/.test(process.argv[1])) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : "inspection failed"); process.exitCode = 1; });
}
