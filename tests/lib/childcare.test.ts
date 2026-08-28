import { describe, it, expect } from "vitest";
import {
  hasChildcareData,
  hasChildcareCapacity,
  childcareOpenRatioPct,
  childcareOpenSlots,
  childcareOpenRatioAge0Pct,
  childcareOpenRatioAge12Pct,
  isChildcareCityAggregate,
  childcareOpenRatioText,
} from "@/lib/childcare";

const base = {
  capacity: 1000,
  enrolled: 800,
  capacityAge0: 100,
  enrolledAge0: 90,
  capacityAge12: 400,
  enrolledAge12: 380,
  hiddenWaitlist: 12,
  source: "こども家庭庁 保育所等関連状況取りまとめ（定員・申込者の状況）",
  asOf: "2026-04-01",
};

describe("childcare ヘルパー", () => {
  it("hasChildcareData / hasChildcareCapacity: 未収録は false、定員0は収録扱いだが capacity は false", () => {
    expect(hasChildcareData(undefined)).toBe(false);
    expect(hasChildcareData(base)).toBe(true);
    expect(hasChildcareCapacity({ ...base, capacity: 0 })).toBe(false);
    expect(hasChildcareCapacity(base)).toBe(true);
  });

  it("定員余裕率 =（定員-利用）/定員×100", () => {
    expect(childcareOpenRatioPct(base)).toBeCloseTo(20);
    expect(childcareOpenSlots(base)).toBe(200);
  });

  it("定員超過受け入れ（弾力運用）は負値をそのまま返す", () => {
    const over = { ...base, enrolled: 1050 };
    expect(childcareOpenRatioPct(over)).toBeCloseTo(-5);
    expect(childcareOpenRatioText(over)).toBe("-5.0%");
  });

  it("定員0・未収録は null / —", () => {
    expect(childcareOpenRatioPct({ ...base, capacity: 0 })).toBeNull();
    expect(childcareOpenRatioPct(undefined)).toBeNull();
    expect(childcareOpenRatioText(undefined)).toBe("—");
  });

  it("年齢別余裕率は年齢別定員が0なら null", () => {
    expect(childcareOpenRatioAge0Pct(base)).toBeCloseTo(10);
    expect(childcareOpenRatioAge12Pct(base)).toBeCloseTo(5);
    expect(childcareOpenRatioAge0Pct({ ...base, capacityAge0: 0 })).toBeNull();
  });

  it("政令市の区（市全体の集計）を source センチネルで判定", () => {
    expect(isChildcareCityAggregate(`${base.source}（横浜市全体の集計）`)).toBe(true);
    expect(isChildcareCityAggregate(base.source)).toBe(false);
  });
});
