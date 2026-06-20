import { describe, it, expect } from "vitest";
import { getRankingBySlug, muniLevelOnly, rankBy, RANKINGS } from "@/lib/rankings";
import { muni, metric } from "../_fixtures";

describe("muniLevelOnly", () => {
  it("政令市の行政区(level:ward)を除外し、市区町村のみ返す", () => {
    const all = [
      muni({ code: "11100", name: "さいたま市" }),
      muni({ code: "11101", name: "西区", level: "ward", parentCode: "11100" }),
      muni({ code: "13103", name: "港区" }), // level未指定=muni（東京特別区）
    ];
    expect(muniLevelOnly(all).map((m) => m.code)).toEqual(["11100", "13103"]);
  });
});

describe("rankBy", () => {
  const cheap = getRankingBySlug("rent-cheap")!;
  const high = getRankingBySlug("rent-high")!;

  const list = [
    muni({ code: "A", rent: metric({ value: 70000 }) }),
    muni({ code: "B", rent: metric({ value: 40000 }) }),
    muni({ code: "C", rent: metric({ value: 0 }) }), // データなし→除外
    muni({ code: "D", rent: metric({ value: 55000 }) }),
  ];

  it("rent-cheap は家賃昇順、データなしは除外", () => {
    expect(rankBy(cheap, list).map((m) => m.code)).toEqual(["B", "D", "A"]);
  });

  it("rent-high は家賃降順", () => {
    expect(rankBy(high, list).map((m) => m.code)).toEqual(["A", "D", "B"]);
  });

  it("limit で上位のみ返す", () => {
    expect(rankBy(cheap, list, 2).map((m) => m.code)).toEqual(["B", "D"]);
  });
});

describe("waitlist-zero ランキング", () => {
  const def = getRankingBySlug("waitlist-zero")!;

  it("待機児童0かつ公表ありのみ対象、人口降順", () => {
    const list = [
      muni({ code: "Z1", population: 100000, waitlistChildren: metric({ value: 0, unit: "人" }) }),
      muni({ code: "Z2", population: 300000, waitlistChildren: metric({ value: 0, unit: "人" }) }),
      muni({ code: "W", population: 500000, waitlistChildren: metric({ value: 5, unit: "人" }) }), // 待機児童あり→除外
      muni({
        code: "U",
        population: 900000,
        waitlistChildren: metric({ value: 0, unit: "人", source: "区別非公表（さいたま市全体で10人）" }),
      }), // 非公表→除外
    ];
    expect(rankBy(def, list).map((m) => m.code)).toEqual(["Z2", "Z1"]);
  });
});

describe("RANKINGS レジストリ", () => {
  it("slug は一意", () => {
    const slugs = RANKINGS.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
