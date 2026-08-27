import { describe, it, expect } from "vitest";
import { MAP_HUBS, mapHubByHref } from "@/lib/siteNav";
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

  it("各地図ハブに少なくとも1つのランキングが対応する（対応の腐り検出）", () => {
    const hrefs = new Set(RANKINGS.map((r) => r.mapHub).filter(Boolean));
    for (const hub of MAP_HUBS) {
      expect(hrefs, `${hub.href} に対応するランキングが無い`).toContain(hub.href);
    }
  });
});
