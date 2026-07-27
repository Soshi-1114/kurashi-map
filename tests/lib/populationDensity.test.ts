import { describe, it, expect } from "vitest";
import { populationDensity, densityText } from "@/lib/populationDensity";
import { getRankingBySlug, rankBy } from "@/lib/rankings";
import { muni } from "../_fixtures";

describe("populationDensity", () => {
  it("人口 ÷ 面積を返す", () => {
    expect(populationDensity(muni({ population: 10000, areaKm2: 5 }))).toBe(2000);
  });
  it("面積未収録・人口0は null", () => {
    expect(populationDensity(muni({ population: 10000 }))).toBeNull();
    expect(populationDensity(muni({ population: 0, areaKm2: 5 }))).toBeNull();
  });
});

describe("densityText", () => {
  it("整数丸め+カンマ+単位", () => {
    expect(densityText(14776.91)).toBe("14,777人/km²");
  });
});

describe("population-density ランキング", () => {
  const high = getRankingBySlug("population-density")!;
  const low = getRankingBySlug("population-density-low")!;

  const list = [
    muni({ code: "A", population: 100000, areaKm2: 10 }), // 10,000
    muni({ code: "B", population: 5000, areaKm2: 100 }),  // 50
    muni({ code: "C", population: 50000 }),               // 面積なし→除外
    muni({ code: "D", population: 30000, areaKm2: 15 }),  // 2,000
  ];

  it("高い順・面積なしは除外", () => {
    expect(rankBy(high, list).map((m) => m.code)).toEqual(["A", "D", "B"]);
  });
  it("低い順", () => {
    expect(rankBy(low, list).map((m) => m.code)).toEqual(["B", "D", "A"]);
  });
  it("display は人/km²表記", () => {
    expect(high.display(list[0])).toBe("10,000人/km²");
  });
});
