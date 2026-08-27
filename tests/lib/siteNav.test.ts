import { describe, it, expect } from "vitest";
import { MAP_HUBS, mapHubForRanking } from "@/lib/siteNav";
import { RANKINGS } from "@/lib/rankings";

describe("mapHubForRanking", () => {
  it("地図ハブがある指標は MAP_HUBS 由来の NavLink を返す", () => {
    const hub = mapHubForRanking("rent-cheap");
    expect(hub).not.toBeNull();
    expect(MAP_HUBS).toContainEqual(expect.objectContaining({ href: hub!.href, label: hub!.label }));
  });

  it("対応ハブが無い指標は null（CTA を出さない）", () => {
    expect(mapHubForRanking("population-most")).toBeNull();
    expect(mapHubForRanking("waitlist-zero")).toBeNull();
    expect(mapHubForRanking("unknown-slug")).toBeNull();
  });

  it("各地図ハブに少なくとも1つのランキングが対応する（対応表の腐り検出）", () => {
    const hrefs = new Set(
      RANKINGS.map((r) => mapHubForRanking(r.slug)?.href).filter(Boolean),
    );
    for (const hub of MAP_HUBS) {
      expect(hrefs, `${hub.href} に対応するランキングが無い`).toContain(hub.href);
    }
  });
});
