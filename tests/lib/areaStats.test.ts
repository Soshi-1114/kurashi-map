import { describe, it, expect } from "vitest";
import { buildAreaStats } from "@/lib/areaStats";
import { muni, metric } from "../_fixtures";

// 比較バーの全国/県平均。honesty 方針の要: 有効値のみの単純平均で、欠損を
// 0 として混ぜたり推計で埋めたりしない。
describe("buildAreaStats", () => {
  it("有効値(>0)のみで平均し、欠損(0以下)は母数に入れない", () => {
    const stats = buildAreaStats([
      muni({ code: "11201", rent: metric({ value: 50000 }) }),
      muni({ code: "11202", rent: metric({ value: 60000 }) }),
      muni({ code: "11203", rent: metric({ value: 70000 }) }),
      muni({ code: "11301", rent: metric({ value: 0 }) }), // データなし
    ]);
    expect(stats.rent.national).toBe(60000); // (50000+60000+70000)/3
  });

  it("平均は四捨五入した整数", () => {
    const stats = buildAreaStats([
      muni({ code: "11201", rent: metric({ value: 50001 }) }),
      muni({ code: "11202", rent: metric({ value: 50002 }) }),
    ]);
    expect(stats.rent.national).toBe(Math.round(100003 / 2));
    expect(Number.isInteger(stats.rent.national)).toBe(true);
  });

  it("県別平均は pref スラッグごとに独立して計算する", () => {
    const stats = buildAreaStats([
      muni({ code: "11201", pref: "saitama", rent: metric({ value: 50000 }) }),
      muni({ code: "11202", pref: "saitama", rent: metric({ value: 70000 }) }),
      muni({ code: "12201", pref: "chiba", rent: metric({ value: 90000 }) }),
    ]);
    expect(stats.rent.byPref.get("saitama")).toBe(60000);
    expect(stats.rent.byPref.get("chiba")).toBe(90000);
    expect(stats.rent.national).toBe(70000);
  });

  it("行政区(level:ward)は集計から除外する（親市と二重計上しない）", () => {
    const stats = buildAreaStats([
      muni({ code: "11100", rent: metric({ value: 60000 }) }),
      muni({ code: "11107", level: "ward", parentCode: "11100", rent: metric({ value: 999999 }) }),
    ]);
    expect(stats.rent.national).toBe(60000);
  });

  it("有効値が1件もなければ national は null（0 と偽らない）", () => {
    const stats = buildAreaStats([muni({ code: "11301", rent: metric({ value: 0 }) })]);
    expect(stats.rent.national).toBeNull();
    expect(stats.rent.byPref.size).toBe(0);
  });

  it("家賃と地価はそれぞれの有効判定で独立に集計する", () => {
    const stats = buildAreaStats([
      // 家賃はあるが地価の標準地がない自治体（landPrice=0）
      muni({ code: "11201", rent: metric({ value: 50000 }), landPrice: metric({ value: 0, unit: "円/㎡" }) }),
      muni({ code: "11202", rent: metric({ value: 70000 }), landPrice: metric({ value: 200000, unit: "円/㎡" }) }),
    ]);
    expect(stats.rent.national).toBe(60000);
    expect(stats.landPrice.national).toBe(200000);
  });
});
