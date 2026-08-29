import { describe, it, expect } from "vitest";
import type { MuniSummary } from "@/lib/types";
import {
  EMPTY_FILTERS,
  isFilterActive,
  matchesFilter,
  buildMatchExpression,
  parseFilters,
  applyFiltersToParams,
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
    floodLevel: 0,
    landslideLevel: -1,
    tsunamiLevel: -1,
    stormSurgeLevel: -1,
    liquefactionLevel: -1,
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
  it("浸水深上限が指定されていれば true（0=浸水なしも有効）", () => {
    expect(isFilterActive(filters({ floodMax: 0 }))).toBe(true);
    expect(isFilterActive(filters({ floodMax: 3 }))).toBe(true);
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

describe("matchesFilter — 浸水深上限（honesty）", () => {
  it("floodMax=0 は浸水なし(0)のみ該当", () => {
    expect(matchesFilter(summary({ floodLevel: 0 }), filters({ floodMax: 0 }))).toBe(true);
    expect(matchesFilter(summary({ floodLevel: 1 }), filters({ floodMax: 0 }))).toBe(false);
  });
  it("floodMax=2 は 0..2 が該当、3 以上は非該当", () => {
    const f = filters({ floodMax: 2 });
    expect(matchesFilter(summary({ floodLevel: 0 }), f)).toBe(true);
    expect(matchesFilter(summary({ floodLevel: 2 }), f)).toBe(true);
    expect(matchesFilter(summary({ floodLevel: 3 }), f)).toBe(false);
  });
  it("未評価（floodLevel=-1）は“安全”扱いせず非該当", () => {
    expect(matchesFilter(summary({ floodLevel: -1 }), filters({ floodMax: 0 }))).toBe(false);
    expect(matchesFilter(summary({ floodLevel: -1 }), filters({ floodMax: 3 }))).toBe(false);
  });
});

describe("matchesFilter — 複合条件（AND）", () => {
  const f = filters({ rentMax: 60000, floodMax: 0 });
  it("両条件を満たせば該当", () => {
    expect(matchesFilter(summary({ rent: 55000, floodLevel: 0 }), f)).toBe(true);
  });
  it("片方でも外れれば非該当", () => {
    expect(matchesFilter(summary({ rent: 80000, floodLevel: 0 }), f)).toBe(false);
    expect(matchesFilter(summary({ rent: 55000, floodLevel: 1 }), f)).toBe(false);
    expect(matchesFilter(summary({ rent: 55000, floodLevel: -1 }), f)).toBe(false);
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
    const expr = buildMatchExpression(filters({ rentMax: 60000, landMax: 100000, floodMax: 0 })) as unknown[];
    expect(expr[0]).toBe("all");
    expect(expr).toHaveLength(4); // "all" + 家賃 + 地価 + 浸水
  });
  it("floodMax=0（浸水なし限定）でも句が立つ", () => {
    const expr = buildMatchExpression(filters({ floodMax: 0 })) as unknown[];
    expect(expr).toHaveLength(2);
  });
  it("浸水句は floodLevel の範囲条件を含む", () => {
    const expr = buildMatchExpression(filters({ floodMax: 2 })) as unknown[];
    expect(JSON.stringify(expr)).toContain("floodLevel");
  });
});

describe("matchesFilter — 空き家率上限", () => {
  const f = filters({ vacancyMax: 15 });
  it("上限以下なら該当（0% は実データとして該当）", () => {
    expect(matchesFilter(summary({ vacancyRate: 12.6 }), f)).toBe(true);
    expect(matchesFilter(summary({ vacancyRate: 15 }), f)).toBe(true);
    expect(matchesFilter(summary({ vacancyRate: 0 }), f)).toBe(true);
  });
  it("上限超なら非該当", () => {
    expect(matchesFilter(summary({ vacancyRate: 20.1 }), f)).toBe(false);
  });
  it("フィールド欠落（集計対象外の町村）は非該当（“該当”扱いしない=honesty）", () => {
    expect(matchesFilter(summary(), f)).toBe(false);
  });
});

describe("matchesFilter — 高齢化率上限", () => {
  const f = filters({ agingMax: 35 });
  it("上限以下なら該当", () => {
    expect(matchesFilter(summary({ agingRate: 22.9 }), f)).toBe(true);
    expect(matchesFilter(summary({ agingRate: 35 }), f)).toBe(true);
  });
  it("上限超なら非該当", () => {
    expect(matchesFilter(summary({ agingRate: 40.1 }), f)).toBe(false);
  });
  it("フィールド欠落（住民登録なし）は非該当", () => {
    expect(matchesFilter(summary(), f)).toBe(false);
  });
  it("URLラウンドトリップに乗る", () => {
    const params = new URLSearchParams();
    applyFiltersToParams(f, params);
    expect(parseFilters(`?${params.toString()}`)).toEqual(f);
  });
});

describe("matchesFilter — 2050年人口の下限", () => {
  const f = filters({ futureMin: -10 });
  it("下限以上なら該当（負値は正常値）", () => {
    expect(matchesFilter(summary({ futureChangeRate: 3.2 }), f)).toBe(true);
    expect(matchesFilter(summary({ futureChangeRate: -10 }), f)).toBe(true);
  });
  it("下限未満なら非該当", () => {
    expect(matchesFilter(summary({ futureChangeRate: -33 }), f)).toBe(false);
  });
  it("futureMin=0 は増加見込みに限定", () => {
    const f0 = filters({ futureMin: 0 });
    expect(matchesFilter(summary({ futureChangeRate: 0 }), f0)).toBe(true);
    expect(matchesFilter(summary({ futureChangeRate: -0.1 }), f0)).toBe(false);
  });
  it("フィールド欠落（推計対象外）は非該当", () => {
    expect(matchesFilter(summary(), f)).toBe(false);
  });
  it("MapLibre 式にも min 方向の句が立つ", () => {
    const expr = buildMatchExpression(f) as unknown[];
    expect(JSON.stringify(expr)).toContain("futureChangeRate");
    expect(JSON.stringify(expr)).toContain('">="');
  });
});

describe("URL 同期（parseFilters / applyFiltersToParams）", () => {
  it("クエリから復元し、選択肢に無い値・未知キーは条件なしに落とす", () => {
    const f = parseFilters("?rentMax=60000&vacancyMax=15&futureMin=0&floodMax=999&code=13104");
    expect(f).toEqual({ ...EMPTY_FILTERS, rentMax: 60000, vacancyMax: 15, futureMin: 0 });
    expect(parseFilters("")).toEqual(EMPTY_FILTERS);
    expect(parseFilters("?rentMax=abc")).toEqual(EMPTY_FILTERS);
  });

  it("applyFiltersToParams は他パラメータを保持し、null 条件はキーごと削除する", () => {
    const params = new URLSearchParams("?code=13104&rentMax=50000");
    applyFiltersToParams(filters({ vacancyMax: 20 }), params);
    expect(params.get("code")).toBe("13104"); // フィルタ以外は触らない
    expect(params.get("vacancyMax")).toBe("20");
    expect(params.get("rentMax")).toBeNull(); // 条件なしに戻したキーは消える
  });

  it("復元→反映のラウンドトリップで状態が保たれる", () => {
    const f = filters({ rentMax: 50000, floodMax: 0, futureMin: -20 });
    const params = new URLSearchParams();
    applyFiltersToParams(f, params);
    expect(parseFilters(`?${params.toString()}`)).toEqual(f);
  });
});
