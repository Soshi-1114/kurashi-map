import { describe, expect, it } from "vitest";
import { parseCohortCsv, selectDiscoveredUrls } from "@/scripts/gsc/cohortCsv";

describe("固定URL群のCSV", () => {
  it("BOM・引用符・改行と列順を解釈する", () => {
    const rows = parseCohortCsv('\uFEFFreason,url\r\n"説明,改行\nあり","https://kurashimap.jp/map"\r\n');
    expect(rows).toEqual([{ reason: "説明,改行\nあり", url: "https://kurashimap.jp/map" }]);
  });
  it("ヘッダー不備と途中で切れたCSVを拒否する", () => {
    expect(() => parseCohortCsv('page\nhttps://kurashimap.jp/map')).toThrow();
    expect(() => parseCohortCsv('url,url\n/map,/map')).toThrow();
    expect(() => parseCohortCsv('url,reason\n"/map')).toThrow();
    expect(() => parseCohortCsv('url,reason\n/map')).toThrow();
  });
  it("最新検査理由ではなく、元のGSCレポート理由で固定群を選ぶ", () => {
    const rows = [
      { url: "https://kurashimap.jp/map", gsc_reason_2026_10_04: "クロール済み", current: "検出 - インデックス未登録" },
      { url: "https://kurashimap.jp/map/hazard", gsc_reason_2026_10_04: "検出 - インデックス未登録", current: "登録済み" },
    ];
    expect([...selectDiscoveredUrls(rows)]).toEqual(["https://kurashimap.jp/map/hazard"]);
    expect(() => selectDiscoveredUrls([{ url: "/map" }])).toThrow();
  });
});
