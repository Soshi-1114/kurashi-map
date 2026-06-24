import { describe, it, expect } from "vitest";
import {
  buildForeignStats,
  avgBand,
  FOREIGN_RATIO_SAME_BAND_PT,
} from "@/lib/foreignStats";
import { muni, metric } from "../_fixtures";

// 外国人比率 r(%) を持つ自治体を作る（population=10000 固定で value を逆算）。
function withRatio(
  code: string,
  pref: string,
  ratioPct: number,
  extra: Parameters<typeof muni>[0] = {},
) {
  const population = 10000;
  return muni({
    code,
    pref,
    population,
    foreignResidents: metric({
      value: Math.round((ratioPct / 100) * population),
      unit: "人",
      source: "出入国在留管理庁 在留外国人統計",
      asOf: "2024-12",
    }),
    ...extra,
  });
}

describe("buildForeignStats", () => {
  it("全国平均は加重平均（Σ外国人÷Σ人口）で算出する", () => {
    const all = [
      withRatio("A", "tokyo", 5),
      withRatio("B", "tokyo", 1),
      withRatio("C", "kanagawa", 3),
    ];
    const stats = buildForeignStats(all);
    // Σ外国人 = 500+100+300 = 900、Σ人口 = 30000 → 3.00%
    expect(stats.get("A")!.nationalAvg).toBeCloseTo(3.0, 5);
    expect(stats.get("A")!.nationalTotal).toBe(3);
  });

  it("全国順位は比率の高い順", () => {
    const all = [
      withRatio("A", "tokyo", 5),
      withRatio("B", "tokyo", 1),
      withRatio("C", "kanagawa", 3),
    ];
    const stats = buildForeignStats(all);
    expect(stats.get("A")!.nationalRank).toBe(1);
    expect(stats.get("C")!.nationalRank).toBe(2);
    expect(stats.get("B")!.nationalRank).toBe(3);
  });

  it("県平均・県内順位は県内のみで集計", () => {
    const all = [
      withRatio("A", "tokyo", 5),
      withRatio("B", "tokyo", 1),
      withRatio("C", "kanagawa", 3),
    ];
    const stats = buildForeignStats(all);
    // tokyo: (500+100)/20000 = 3.00%
    expect(stats.get("A")!.prefAvg).toBeCloseTo(3.0, 5);
    expect(stats.get("A")!.prefRank).toBe(1);
    expect(stats.get("A")!.prefTotal).toBe(2);
    expect(stats.get("B")!.prefRank).toBe(2);
    // kanagawa は1自治体のみ
    expect(stats.get("C")!.prefTotal).toBe(1);
    expect(stats.get("C")!.prefRank).toBe(1);
  });

  it("行政区(level:ward)・対象外・人口0は集計対象外", () => {
    const all = [
      withRatio("A", "tokyo", 5),
      withRatio("W", "tokyo", 9, { level: "ward", parentCode: "A" }),
      withRatio("X", "tokyo", 9, {
        foreignResidents: metric({ value: 100, source: "対象外（北方領土）" }),
      }),
      withRatio("Y", "tokyo", 9, { population: 0 }),
    ];
    const stats = buildForeignStats(all);
    expect(stats.has("A")).toBe(true);
    expect(stats.has("W")).toBe(false);
    expect(stats.has("X")).toBe(false);
    expect(stats.has("Y")).toBe(false);
    expect(stats.get("A")!.nationalTotal).toBe(1);
  });
});

describe("avgBand", () => {
  it("閾値を超えて高ければ higher、低ければ lower、範囲内は similar", () => {
    const avg = 3.0;
    expect(avgBand(avg + FOREIGN_RATIO_SAME_BAND_PT + 0.01, avg)).toBe("higher");
    expect(avgBand(avg - FOREIGN_RATIO_SAME_BAND_PT - 0.01, avg)).toBe("lower");
    expect(avgBand(avg, avg)).toBe("similar");
    expect(avgBand(avg + FOREIGN_RATIO_SAME_BAND_PT / 2, avg)).toBe("similar");
  });
});
