import { readRecords, type InspectionRecord } from "./indexInspection";
import fs from "node:fs";

export type InspectionChange = {
  url: string;
  before: string;
  after: string;
  recrawled: boolean;
  canonicalChanged: boolean;
};

function latestByUrl(records: InspectionRecord[]): Map<string, InspectionRecord> {
  return new Map(records.map((record) => [record.url, record]));
}

export function diffInspections(before: InspectionRecord[], after: InspectionRecord[]): InspectionChange[] {
  const oldByUrl = latestByUrl(before);
  const newByUrl = latestByUrl(after);
  return [...new Set([...oldByUrl.keys(), ...newByUrl.keys()])].map((url) => {
    const old = oldByUrl.get(url);
    const next = newByUrl.get(url);
    const state = (record?: InspectionRecord) => !record ? "not inspected" : record.error ? "error" : record.coverageState ?? record.verdict ?? "unknown";
    return {
      url,
      before: state(old),
      after: state(next),
      recrawled: Boolean(old && next && !old.error && !next.error && next.lastCrawlTime && (!old.lastCrawlTime || next.lastCrawlTime > old.lastCrawlTime)),
      canonicalChanged: Boolean(old && next && !old.error && !next.error && old.googleCanonical !== next.googleCanonical),
    };
  });
}

if (process.argv[1] && /indexInspectionDiff\.[cm]?[jt]s$/.test(process.argv[1])) {
  const [beforePath, afterPath] = process.argv.slice(2);
  if (!beforePath || !afterPath) throw new Error("usage: indexInspectionDiff.ts before.jsonl after.jsonl");
  if (!fs.existsSync(beforePath) || !fs.existsSync(afterPath)) throw new Error("比較元・比較先の両ファイルが必要です");
  const changes = diffInspections(readRecords(beforePath), readRecords(afterPath));
  const transitions = changes.filter((row) => row.before !== row.after || row.recrawled || row.canonicalChanged);
  process.stdout.write(JSON.stringify({ cohort: changes.length, changed: transitions.length, transitions }, null, 2) + "\n");
}
