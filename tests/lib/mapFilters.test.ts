import { describe, it, expect } from "vitest";
import type { MuniSummary } from "@/lib/types";
import {
  EMPTY_FILTERS,
  isFilterActive,
  matchesFilter,
  buildMatchExpression,
  type MapFilters,
} from "@/lib/mapFilters";

function summary(partial: Partial<MuniSummary> = {}): MuniSummary {
  return {
    code: "11203",
    pref: "saitama",
    name: "川口市",
    rent: 60000,
    landPrice: 200000,
    populationTrend: "横ばい",
    hasFloodRisk: false,
    hazardEvaluated: true,
    ...partial,
  };
}

function filters(partial: Partial<MapFilters> = {}): MapFilters {
  return { ...EMPTY_FILTERS, ...partial };
}

describe("isFilterActive", () => {
  it("全条件 null/false なら false", () => {
    expect(isFilterActive(EMPTY_FILTERS)).toBe(false);
  });
  it("家賃上限が指定されていれば true", () => {
    expect(isFilterActive(filters({ rentMax: 60000 }))).toBe(true);
  });
  it("地価上限が指定されていれば true", () => {
    expect(isFilterActive(filters({ landMax: 100000 }))).toBe(true);
  });
  it("浸水トグルが ON なら true", () => {
    expect(isFilterActive(filters({ noFlood: true }))).toBe(true);
  });
});

describe("matchesFilter — 家賃上限", () => {
  const f = filters({ rentMax: 60000 });
  it("上限以下なら該当", () => {
    expect(matchesFilter(summary({ rent: 55000 }), f)).toBe(true);
    expect(matchesFilter(summary({ rent: 60000 }), f)).toBe(true);
  });
  it("上限超なら非該当", () => {
    expect(matchesFilter(summary({ rent: 70000 }), f)).toBe(false);
  });
  it("欠損（rent<=0）は非該当", () => {
    expect(matchesFilter(summary({ rent: 0 }), f)).toBe(false);
    expect(matchesFilter(summary({ rent: -1 }), f)).toBe(false);
  });
});

describe("matchesFilter — 地価上限", () => {
  const f = filters({ landMax: 100000 });
  it("上限以下なら該当", () => {
    expect(matchesFilter(summary({ landPrice: 80000 }), f)).toBe(true);
    expect(matchesFilter(summary({ landPrice: 100000 }), f)).toBe(true);
  });
  it("上限超なら非該当", () => {
    expect(matchesFilter(summary({ landPrice: 150000 }), f)).toBe(false);
  });
  it("欠損（landPrice<=0）は非該当", () => {
    expect(matchesFilter(summary({ landPrice: 0 }), f)).toBe(false);
  });
});

describe("matchesFilter — 浸水リスクなし限定（honesty）", () => {
  const f = filters({ noFlood: true });
  it("評価済み かつ 浸水なし なら該当", () => {
    expect(matchesFilter(summary({ hazardEvaluated: true, hasFloodRisk: false }), f)).toBe(true);
  });
  it("浸水ありなら非該当", () => {
    expect(matchesFilter(summary({ hazardEvaluated: true, hasFloodRisk: true }), f)).toBe(false);
  });
  it("未評価（hazardEvaluated=false）は“安全”扱いせず非該当", () => {
    expect(matchesFilter(summary({ hazardEvaluated: false, hasFloodRisk: false }), f)).toBe(false);
  });
});

describe("matchesFilter — 複合条件（AND）", () => {
  const f = filters({ rentMax: 60000, noFlood: true });
  it("両条件を満たせば該当", () => {
    expect(matchesFilter(summary({ rent: 55000, hazardEvaluated: true, hasFloodRisk: false }), f)).toBe(true);
  });
  it("片方でも外れれば非該当", () => {
    expect(matchesFilter(summary({ rent: 80000, hazardEvaluated: true, hasFloodRisk: false }), f)).toBe(false);
    expect(matchesFilter(summary({ rent: 55000, hazardEvaluated: true, hasFloodRisk: true }), f)).toBe(false);
    expect(matchesFilter(summary({ rent: 55000, hazardEvaluated: false, hasFloodRisk: false }), f)).toBe(false);
  });
});

describe("buildMatchExpression", () => {
  it("フィルタ無効なら null", () => {
    expect(buildMatchExpression(EMPTY_FILTERS)).toBeNull();
  });
  it("有効なら [\"all\", ...] 構造を返す", () => {
    const expr = buildMatchExpression(filters({ rentMax: 60000 })) as unknown[];
    expect(Array.isArray(expr)).toBe(true);
    expect(expr[0]).toBe("all");
    expect(expr).toHaveLength(2); // "all" + 家賃句
  });
  it("複数条件は句が増える", () => {
    const expr = buildMatchExpression(filters({ rentMax: 60000, landMax: 100000, noFlood: true })) as unknown[];
    expect(expr[0]).toBe("all");
    expect(expr).toHaveLength(4); // "all" + 家賃 + 地価 + 浸水
  });
  it("浸水句は hazardEvaluated==1 かつ hasFloodRisk==0 を含む", () => {
    const expr = buildMatchExpression(filters({ noFlood: true })) as unknown[];
    expect(JSON.stringify(expr)).toContain("hazardEvaluated");
    expect(JSON.stringify(expr)).toContain("hasFloodRisk");
  });
});
