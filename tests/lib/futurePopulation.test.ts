import { describe, it, expect } from "vitest";
import {
  FUTURE_NODATA,
  hasFuturePopulation,
  futureTotal,
  futureChangeRate2050,
  elderlyRatio2050,
} from "@/lib/futurePopulation";
import { listAllAcrossPrefs } from "@/lib/metrics";

const SOURCE = "国立社会保障・人口問題研究所 日本の地域別将来推計人口（令和5年推計）";

function fp(partial: Record<string, unknown> = {}) {
  return {
    base2020: 100000,
    total: { "2025": 97000, "2030": 94000, "2035": 90000, "2040": 86000, "2045": 82000, "2050": 78000 },
    young2050: 7000,
    working2050: 40000,
    elderly2050: 31000,
    source: SOURCE,
    asOf: "2023",
    ...partial,
  };
}

describe("hasFuturePopulation", () => {
  it("実データは true、未収録（undefined）は false", () => {
    expect(hasFuturePopulation(fp())).toBe(true);
    expect(hasFuturePopulation(undefined)).toBe(false);
  });

  it("「対象外」センチネルは false", () => {
    expect(
      hasFuturePopulation(fp({ base2020: 0, total: {}, source: "対象外（北方領土）" })),
    ).toBe(false);
  });
});

describe("futureChangeRate2050", () => {
  it("IPSS 内部の2020年基準人口を分母に増減率（%）を返す", () => {
    // (78000 - 100000) / 100000 = -22%
    expect(futureChangeRate2050(fp())).toBeCloseTo(-22);
  });

  it("増加もそのまま正の率で返す（川口市のような増加自治体がある）", () => {
    expect(futureChangeRate2050(fp({ total: { ...fp().total, "2050": 101000 } }))).toBeCloseTo(1);
  });

  it("対象外・未収録は FUTURE_NODATA", () => {
    expect(futureChangeRate2050(undefined)).toBe(FUTURE_NODATA);
    expect(futureChangeRate2050(fp({ base2020: 0, total: {}, source: "対象外（北方領土）" }))).toBe(FUTURE_NODATA);
  });
});

describe("elderlyRatio2050", () => {
  it("2050年の高齢化率（65歳以上÷総人口）を%で返す", () => {
    expect(elderlyRatio2050(fp())).toBeCloseTo((31000 / 78000) * 100);
  });

  it("対象外は FUTURE_NODATA", () => {
    expect(elderlyRatio2050(fp({ base2020: 0, total: {}, source: "対象外（浜通り…）" }))).toBe(FUTURE_NODATA);
  });
});

describe("futureTotal", () => {
  it("指定年の推計人口。無い年・対象外は null", () => {
    expect(futureTotal(fp(), "2040")).toBe(86000);
    expect(futureTotal(fp(), "2060")).toBeNull();
    expect(futureTotal(undefined, "2050")).toBeNull();
  });
});

describe("実データ（全県ロード）", () => {
  it("1,897自治体が実データ、21自治体が対象外センチネルを持つ", async () => {
    const all = await listAllAcrossPrefs();
    const withField = all.filter((m) => m.futurePopulation !== undefined);
    expect(withField.length).toBe(1918); // 全自治体にフィールドが入っている
    const has = all.filter((m) => hasFuturePopulation(m.futurePopulation));
    expect(has.length).toBe(1897);
    const excluded = withField.filter((m) => !hasFuturePopulation(m.futurePopulation));
    expect(excluded.length).toBe(21);
    // 対象外は数値が入っていない（0を実データに見せない）
    for (const m of excluded) {
      expect(m.futurePopulation?.base2020).toBe(0);
      expect(Object.keys(m.futurePopulation?.total ?? {}).length).toBe(0);
    }
  });

  it("実データは年齢3区分の合計が2050年総人口と一致する（IPSS 公表値の内部整合）", async () => {
    const all = await listAllAcrossPrefs();
    for (const m of all) {
      const f = m.futurePopulation;
      if (!hasFuturePopulation(f)) continue;
      expect(f.young2050 + f.working2050 + f.elderly2050).toBe(f.total["2050"]);
    }
  });
});
