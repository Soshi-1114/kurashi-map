import { afterEach, describe, expect, it, vi } from "vitest";
import { diffInspections } from "@/scripts/gsc/indexInspectionDiff";
import { inspectUrl, runInspections, summarize, type InspectionRecord } from "@/scripts/gsc/indexInspection";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

afterEach(() => vi.unstubAllGlobals());

const record = (url: string, coverageState: string, lastCrawlTime?: string): InspectionRecord => ({
  url, coverageState, lastCrawlTime, checkedAt: "2026-10-11T00:00:00Z", verdict: "NEUTRAL",
});

describe("GSCの固定URL群", () => {
  it("成功済みURLを再取得せず、失敗を保存して再開できる", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gsc-review-"));
    try {
      const output = path.join(directory, "snapshot.jsonl");
      const urls = ["https://kurashimap.jp/map", "https://kurashimap.jp/map/hazard"];
      fs.writeFileSync(output, JSON.stringify(record(urls[0], "登録済み")) + "\n");
      const inspect = vi.fn().mockResolvedValue({ ...record(urls[1], ""), error: "HTTP 500" });
      const authorize = vi.fn().mockResolvedValue("test-token");
      const wait = vi.fn().mockResolvedValue(undefined);
      expect((await runInspections(urls, output, "sc-domain:kurashimap.jp", { inspect, authorize, wait })).complete).toBe(false);
      expect(inspect).toHaveBeenCalledExactlyOnceWith(urls[1], "sc-domain:kurashimap.jp", "test-token");
      inspect.mockResolvedValue(record(urls[1], "登録済み"));
      expect((await runInspections(urls, output, "sc-domain:kurashimap.jp", { inspect, authorize, wait })).complete).toBe(true);
      expect(inspect).toHaveBeenCalledTimes(2);
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  });
  it("429を再試行して構造化した検査結果を保存する", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(Response.json({ inspectionResult: { indexStatusResult: { verdict: "PASS", coverageState: "登録済み", indexingState: "INDEXING_ALLOWED" } } }));
    vi.stubGlobal("fetch", fetchMock);
    const wait = vi.fn().mockResolvedValue(undefined);
    const result = await inspectUrl("https://kurashimap.jp/map", "sc-domain:kurashimap.jp", "test-token", wait);
    expect(result).toMatchObject({ verdict: "PASS", indexing: "INDEXING_ALLOWED" });
    expect(wait).toHaveBeenCalledWith(1000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("結果フィールドの欠落を登録状態として集計しない", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({})));
    expect(await inspectUrl("https://kurashimap.jp/map", "sc-domain:kurashimap.jp", "test-token"))
      .toMatchObject({ error: "missing indexStatusResult" });
  });
  it("空のindexStatusResultも取得失敗として扱う", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ inspectionResult: { indexStatusResult: {} } })));
    expect(await inspectUrl("https://kurashimap.jp/map", "sc-domain:kurashimap.jp", "test-token"))
      .toMatchObject({ error: "missing indexStatusResult" });
  });
  it("最新状態で数え、取得失敗を未登録に混ぜない", () => {
    const rows = [record("https://kurashimap.jp/map", "Discovered - currently not indexed"),
      { ...record("https://kurashimap.jp/map", "Submitted and indexed"), verdict: "PASS" },
      { ...record("https://kurashimap.jp/map/hazard", ""), error: "HTTP 429" }];
    expect(summarize(rows)).toEqual({ "PASS: Submitted and indexed": 1, error: 1 });
  });

  it("登録理由、再クロール、canonical変更を同じURLで追う", () => {
    const url = "https://kurashimap.jp/map";
    const before = [{ ...record(url, "Discovered - currently not indexed", "2026-08-30T00:00:00Z"), googleCanonical: url }];
    const after = [{ ...record(url, "Crawled - currently not indexed", "2026-10-11T00:00:00Z"), googleCanonical: "https://example.org/" }];
    expect(diffInspections(before, after)).toEqual([{
      url, before: "Discovered - currently not indexed", after: "Crawled - currently not indexed", recrawled: true, canonicalChanged: true,
    }]);
  });
  it("今回だけのURLと未検査URLも差分に残し、失敗を保持する", () => {
    const before = [{ ...record("https://kurashimap.jp/map", ""), error: "HTTP 500" }];
    const after = [record("https://kurashimap.jp/map/hazard", "登録済み")];
    expect(diffInspections(before, after)).toEqual([
      { url: "https://kurashimap.jp/map", before: "error", after: "not inspected", recrawled: false, canonicalChanged: false },
      { url: "https://kurashimap.jp/map/hazard", before: "not inspected", after: "登録済み", recrawled: false, canonicalChanged: false },
    ]);
  });
});
