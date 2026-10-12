import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { verifiedLastModified, type PageRevision } from "@/lib/pageRevisions";
import { absoluteUrl } from "@/lib/site";
import { MAP_HUBS } from "@/lib/siteNav";

describe("sitemap", () => {
  const entriesP = sitemap();

  it("全URLを一度だけ掲載し、地図ハブも欠けない", async () => {
    const entries = await entriesP;
    expect(entries.length).toBe(3139);
    expect(new Set(entries.map((e) => e.url)).size).toBe(entries.length);
    for (const path of ["/", "/map", ...MAP_HUBS.map((h) => h.href), "/ranking", "/compare"]) {
      expect(entries.some((e) => e.url === absoluteUrl(path))).toBe(true);
    }
  }, 20_000);

  it("証跡のない統計基準年やビルド時刻を更新日として出さない", async () => {
    const entries = await entriesP;
    for (const entry of entries) {
      const expected = verifiedLastModified(new URL(entry.url).pathname);
      expect(entry.lastModified).toEqual(expected);
    }
  });
});

describe("verifiedLastModified", () => {
  it("該当URLの証跡付き公開日の最新値を選ぶ", () => {
    const records: PageRevision[] = [
      { scope: { paths: ["/map"] }, publishedAt: "2026-08-28", evidence: "deployment-a" },
      { scope: { paths: ["/map"] }, publishedAt: "2026-09-01", evidence: "deployment-b" },
      { scope: { paths: ["/map/hazard"] }, publishedAt: "2026-09-02", evidence: "deployment-c" },
    ];
    expect(verifiedLastModified("/map", records)?.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(verifiedLastModified("/map/vacancy", records)).toBeUndefined();
  });

  it("証跡なし・不正日付・未来日を採用しない", () => {
    const records: PageRevision[] = [
      { scope: { paths: ["/map"] }, publishedAt: "2026-10-01", evidence: "" },
      { scope: { paths: ["/map"] }, publishedAt: "2026-02-30", evidence: "deployment-a" },
      { scope: { paths: ["/map"] }, publishedAt: "2999-01-01", evidence: "deployment-b" },
    ];
    expect(verifiedLastModified("/map", records)).toBeUndefined();
  });

  it("テンプレートの同時更新を許容し、対象外のURLは変えない", () => {
    const records: PageRevision[] = [{ scope: { template: "prefRanking" }, publishedAt: "2026-09-01", evidence: "deployment-a" }];
    expect(verifiedLastModified("/ranking/stations/kyoto", records)?.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(verifiedLastModified("/ranking/rent-cheap/yamanashi", records)?.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(verifiedLastModified("/ranking/stations/prefecture", records)).toBeUndefined();
    expect(verifiedLastModified("/ranking/stations", records)).toBeUndefined();
  });
});
