import { describe, it, expect } from "vitest";
import { MAP_HUBS, mapHubByHref, compareHref } from "@/lib/siteNav";
import { RANKINGS } from "@/lib/rankings";

describe("mapHubByHref / RankingDef.mapHub", () => {
  it("mapHub を持つ指標はすべて MAP_HUBS の実在ハブに解決される", () => {
    for (const r of RANKINGS) {
      if (!r.mapHub) continue;
      const hub = mapHubByHref(r.mapHub);
      expect(hub, `${r.slug} → ${r.mapHub}`).not.toBeNull();
      expect(MAP_HUBS).toContain(hub);
    }
  });

  it("未設定・未知の href は null（CTA を出さない）", () => {
    expect(mapHubByHref(undefined)).toBeNull();
    expect(mapHubByHref("/map/unknown")).toBeNull();
  });

  it("compareHref: codes をカンマ連結し、from を計測用に付ける", () => {
    expect(compareHref(["11203"], "ranking_row")).toBe("/compare?codes=11203&from=ranking_row");
    expect(compareHref(["13101", "27100", "14100"], "ranking_top3")).toBe(
      "/compare?codes=13101,27100,14100&from=ranking_top3",
    );
  });

  it("compareHref: from はURLエンコードする（クエリ壊れの防止）", () => {
    expect(compareHref(["11203"], "a&b=c")).toBe("/compare?codes=11203&from=a%26b%3Dc");
  });

  it("各地図ハブに少なくとも1つのランキングが対応する（対応の腐り検出）", () => {
    // /map/hazard はオーバーレイ型ハブで、対応するランキングを持たない
    // （災害リスクの順位付けはしない方針）。
    const NO_RANKING_HUBS = ["/map/hazard"];
    const hrefs = new Set(RANKINGS.map((r) => r.mapHub).filter(Boolean));
    for (const hub of MAP_HUBS.filter((h) => !NO_RANKING_HUBS.includes(h.href))) {
      expect(hrefs, `${hub.href} に対応するランキングが無い`).toContain(hub.href);
    }
  });
});
