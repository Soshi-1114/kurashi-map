import { describe, it, expect } from "vitest";
import { findRelatedByRent, findClosePopulationInPref } from "@/lib/related";
import { muni, metric } from "../_fixtures";

describe("findRelatedByRent", () => {
  const target = muni({ code: "00000", rent: metric({ value: 60000 }) });
  const all = [
    target,
    muni({ code: "A", rent: metric({ value: 61000 }) }),
    muni({ code: "B", rent: metric({ value: 50000 }) }),
    muni({ code: "C", rent: metric({ value: 59000 }) }),
    muni({ code: "D", rent: metric({ value: 80000 }) }),
  ];

  it("自身を除外し家賃が近い順に返す", () => {
    const r = findRelatedByRent(all, target);
    expect(r.map((m) => m.code)).toEqual(["A", "C", "B", "D"]);
  });

  it("limit で件数を絞る", () => {
    expect(findRelatedByRent(all, target, 2).map((m) => m.code)).toEqual(["A", "C"]);
  });
});

describe("findClosePopulationInPref", () => {
  const target = muni({ code: "00000", population: 100000 });
  const all = [
    target,
    muni({ code: "A", population: 95000 }),
    muni({ code: "B", population: 300000 }),
    muni({ code: "C", population: 104000 }),
    muni({ code: "D", population: 0 }), // 人口なし → 対象外
  ];

  it("自身と人口0を除外し、人口差が小さい順に返す", () => {
    const r = findClosePopulationInPref(all, target);
    expect(r.map((m) => m.code)).toEqual(["C", "A", "B"]);
  });

  it("exclude のコードは候補から外す", () => {
    const r = findClosePopulationInPref(all, target, 4, new Set(["C"]));
    expect(r.map((m) => m.code)).toEqual(["A", "B"]);
  });

  it("target の人口が0なら空配列", () => {
    expect(findClosePopulationInPref(all, muni({ code: "X", population: 0 }))).toEqual([]);
  });

  it("人口差が同値なら code 順で決定論的", () => {
    const tie = [
      muni({ code: "Z", population: 99000 }),
      muni({ code: "Y", population: 101000 }),
    ];
    const r = findClosePopulationInPref([target, ...tie], target, 2);
    expect(r.map((m) => m.code)).toEqual(["Y", "Z"]);
  });
});
