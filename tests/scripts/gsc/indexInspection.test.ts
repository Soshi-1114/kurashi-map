import { afterEach, describe, expect, it, vi } from "vitest";
import { diffInspections } from "@/scripts/gsc/indexInspectionDiff";
import { inspectUrl, summarize, type InspectionRecord } from "@/scripts/gsc/indexInspection";

afterEach(() => vi.unstubAllGlobals());

const record = (url: string, coverageState: string, lastCrawlTime?: string): InspectionRecord => ({
  url, coverageState, lastCrawlTime, checkedAt: "2026-10-11T00:00:00Z", verdict: "NEUTRAL",
});

describe("GSCの固定URL群", () => {
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
});
