import { describe, it, expect } from "vitest";
import { MAP_HUBS, mapHubByHref, compareHref, shindanHref, parseToolSource, parseCompareAttribution } from "@/lib/siteNav";
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

  it("parseToolSource: 外部入力は許可済みの送客元だけ通す", () => {
    expect(parseToolSource("pref_ranking_top3")).toBe("pref_ranking_top3");
    expect(parseToolSource("area_detail")).toBe("area_detail");
    expect(parseToolSource("map")).toBe("map");
    expect(parseToolSource("a&b=c")).toBeNull();
    expect(parseToolSource(null)).toBeNull();
  });

  it("compareHref: 比較導線の実験情報は許可したページ・variantだけ渡す", () => {
    const href = compareHref(["27100", "40130"], "pref_ranking_top3", {
      experimentId: "compare-link-2026-09", variant: "baseline", originPath: "/ranking/population-growth/osaka",
    });
    const params = new URLSearchParams(href.split("?")[1]);
    expect(params.get("codes")).toBe("27100,40130");
    expect(parseCompareAttribution(params)).toEqual({
      experimentId: "compare-link-2026-09", variant: "baseline", originPath: "/ranking/population-growth/osaka",
    });
    params.set("origin_path", "https://outside.example/");
    expect(parseCompareAttribution(params)).toBeNull();
  });

  it("shindanHref: from を計測用に付ける（着地側 useToolEntry が tool_entry として送る）", () => {
    expect(shindanHref("home")).toBe("/shindan?from=home");
    expect(shindanHref("header")).toBe("/shindan?from=header");
    expect(shindanHref("pref_ranking")).toBe("/shindan?from=pref_ranking");
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
