import { describe, it, expect } from "vitest";
import { buildPrefRanks } from "@/lib/prefRanks";
import { RANKINGS } from "@/lib/rankings";
import { muni, metric } from "../_fixtures";

// 県内順位（詳細ページの「県内◯位」）。ランキング定義の qualifies/sortValue を
// 流用し、県ごとに独立して順位を振る。行政区・欠損値は順位を持たない。
describe("buildPrefRanks", () => {
  const all = [
    muni({ code: "11201", pref: "saitama", population: 500000, rent: metric({ value: 50000 }) }),
    muni({ code: "11202", pref: "saitama", population: 300000, rent: metric({ value: 40000 }) }),
    muni({ code: "11203", pref: "saitama", population: 100000, rent: metric({ value: 0 }) }), // 家賃データなし
    muni({ code: "12201", pref: "chiba", population: 900000, rent: metric({ value: 70000 }) }),
    muni({ code: "11107", pref: "saitama", level: "ward" as const, parentCode: "11100", population: 999999 }),
  ];

  it("人口順位（population-most）は県ごとに独立して振られる", () => {
    const ranks = buildPrefRanks(all);
    const pop = ranks.get("population-most")!;
    expect(pop.get("11201")).toEqual({ rank: 1, total: 3 });
    expect(pop.get("11202")).toEqual({ rank: 2, total: 3 });
    expect(pop.get("12201")).toEqual({ rank: 1, total: 1 });
  });

  it("行政区は順位を持たない（lookup undefined）", () => {
    const ranks = buildPrefRanks(all);
    expect(ranks.get("population-most")!.get("11107")).toBeUndefined();
  });

  it("RANKINGS の全 slug をキーに持つ（個別指標をハードコードせず自動追従する）", () => {
    const ranks = buildPrefRanks(all);
    expect(ranks.size).toBe(RANKINGS.length);
    for (const def of RANKINGS) {
      expect(ranks.has(def.slug)).toBe(true);
    }
  });

  it("欠損値（rent=0）の自治体は家賃順位の母数に入らない", () => {
    const ranks = buildPrefRanks(all);
    const rent = ranks.get("rent-cheap")!;
    expect(rent.get("11202")).toEqual({ rank: 1, total: 2 }); // 40000 が県内最安
    expect(rent.get("11201")).toEqual({ rank: 2, total: 2 });
    expect(rent.get("11203")).toBeUndefined();
  });

  it("決定論: 同じ入力で同じ結果", () => {
    expect(buildPrefRanks(all)).toEqual(buildPrefRanks(all));
  });
});
