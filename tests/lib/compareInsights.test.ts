import { describe, expect, it } from "vitest";
import { compareInsights } from "@/lib/compareInsights";
import type { Municipality } from "@/lib/types";
import data from "@/data/ibaraki.json";

const sample = (overrides: Partial<Municipality> = {}) => ({ ...data[0], ...overrides }) as Municipality;
describe("比較の早見", () => {
  it("1件では比較を生成しない", () => expect(compareInsights([sample()])).toEqual([]));
  it("有効な人口・増減・家賃の実数を最大3点で表示する", () => {
    const result = compareInsights([sample({ name: "A市", populationChangeRate: 1 }), sample({ name: "B市", populationChangeRate: -2 })]);
    expect(result).toHaveLength(3);
    expect(result[0]).toContain("A市");
    expect(result[1]).toContain("-2");
    expect(result[2]).toContain("現在の募集家賃");
  });
  it("家賃の年度が異なる場合に差額を計算しない", () => {
    const a = sample();
    const b = sample({ rent: { ...a.rent, value: a.rent.value + 10000, asOf: "1999" } });
    expect(compareInsights([a, b]).at(-1)).toContain("差額は計算していません");
    expect(compareInsights([a, b]).join("")).not.toContain("最大差");
  });
  it("欠損の家賃や増減をゼロとして要約しない", () => {
    const a = sample();
    const b = sample({ rent: { ...a.rent, value: -1 }, populationChangeRate: undefined });
    expect(compareInsights([a, b])).toHaveLength(1);
  });
  it("欠損人口を0人の実数として要約しない", () => {
    expect(compareInsights([sample({ population: 0 }), sample()]).join("")).not.toContain("人口は、");
  });

});
