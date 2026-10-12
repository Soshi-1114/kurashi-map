import { readRecords, type InspectionRecord } from "./indexInspection";

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
  return [...oldByUrl].map(([url, old]) => {
    const next = newByUrl.get(url);
    if (!next) return { url, before: old.coverageState ?? "unknown", after: "not inspected", recrawled: false, canonicalChanged: false };
    return {
      url,
      before: old.error ? "error" : old.coverageState ?? old.verdict ?? "unknown",
      after: next.error ? "error" : next.coverageState ?? next.verdict ?? "unknown",
      recrawled: Boolean(!next.error && next.lastCrawlTime && (!old.lastCrawlTime || next.lastCrawlTime > old.lastCrawlTime)),
      canonicalChanged: Boolean(!old.error && !next.error && old.googleCanonical !== next.googleCanonical),
    };
  });
}

if (process.argv[1] && /indexInspectionDiff\.[cm]?[jt]s$/.test(process.argv[1])) {
  const [beforePath, afterPath] = process.argv.slice(2);
  if (!beforePath || !afterPath) throw new Error("usage: indexInspectionDiff.ts before.jsonl after.jsonl");
  const changes = diffInspections(readRecords(beforePath), readRecords(afterPath));
  const transitions = changes.filter((row) => row.before !== row.after || row.recrawled || row.canonicalChanged);
  process.stdout.write(JSON.stringify({ cohort: changes.length, changed: transitions.length, transitions }, null, 2) + "\n");
}
