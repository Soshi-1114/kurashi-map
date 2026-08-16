import { describe, it, expect } from "vitest";
import {
  HOUSEHOLD_KWH,
  HOUSEHOLD_KWH_SOURCE,
  defaultAmpere,
  estimateMonthly,
  compareOffers,
} from "@/lib/denkiSim";
import type { DenkiAreaPricing } from "@/lib/denkiPlans";
import { denkiPricing, denkiPlan, denkiPlansFile } from "../_fixtures";

// アンペア制（従量電灯B型）: 基本 30A=900 / 40A=1200 / 50A=1500、
// 従量 〜120=20円 / 120〜300=25円 / 300〜=28円（tests/_fixtures.ts の既定値）
const amperePricing = denkiPricing();

// 最低料金制（従量電灯A型）: 最低料金 400円（最初の15kWhを含む）、従量は同じ3段階
const minimumPricing = denkiPricing({
  basic: { type: "minimum", yenPerMonth: 400, includedKwh: 15 },
});

describe("estimateMonthly (アンペア制)", () => {
  it("使用量 0 は基本料金のみ", () => {
    expect(estimateMonthly(amperePricing, 0, 30)).toBe(900);
  });
  it("契約アンペアで基本料金が変わる", () => {
    expect(estimateMonthly(amperePricing, 0, 40)).toBe(1200);
    expect(estimateMonthly(amperePricing, 0, 50)).toBe(1500);
  });
  it("第1段階の境界ちょうど（120kWh）", () => {
    expect(estimateMonthly(amperePricing, 120, 30)).toBe(900 + 120 * 20);
  });
  it("第2段階に 1kWh だけ入る（121kWh）", () => {
    expect(estimateMonthly(amperePricing, 121, 30)).toBe(900 + 120 * 20 + 1 * 25);
  });
  it("第2段階の境界ちょうど（300kWh）", () => {
    expect(estimateMonthly(amperePricing, 300, 30)).toBe(900 + 120 * 20 + 180 * 25);
  });
  it("第3段階（400kWh）", () => {
    expect(estimateMonthly(amperePricing, 400, 30)).toBe(900 + 120 * 20 + 180 * 25 + 100 * 28);
  });
  it("円未満は四捨五入", () => {
    const p: DenkiAreaPricing = {
      basic: { type: "ampere", yenPerMonth: { "30": 100.4, "40": 100.4, "50": 100.4 } },
      tiers: [{ upTo: null, yenPerKwh: 10.01 }],
    };
    // 100.4 + 10 * 10.01 = 200.5 → 201
    expect(estimateMonthly(p, 10, 30)).toBe(201);
  });
});

describe("estimateMonthly (最低料金制)", () => {
  it("最低料金内（10kWh）は最低料金のみ", () => {
    expect(estimateMonthly(minimumPricing, 10, 30)).toBe(400);
  });
  it("含まれる電力量ちょうど（15kWh）も最低料金のみ", () => {
    expect(estimateMonthly(minimumPricing, 15, 30)).toBe(400);
  });
  it("超過分だけ第1段階で課金（120kWh → 105kWh 分）", () => {
    expect(estimateMonthly(minimumPricing, 120, 30)).toBe(400 + 105 * 20);
  });
  it("第2段階（300kWh）", () => {
    expect(estimateMonthly(minimumPricing, 300, 30)).toBe(400 + 105 * 20 + 180 * 25);
  });
  it("契約アンペアは無視される", () => {
    expect(estimateMonthly(minimumPricing, 120, 30)).toBe(estimateMonthly(minimumPricing, 120, 50));
  });
});

describe("compareOffers", () => {
  const file = denkiPlansFile({
    plans: [
      denkiPlan({ offerId: "baseline-tokyo" }),
      denkiPlan({
        offerId: "cheap-power",
        company: "安い電力",
        planName: "プランS",
        kind: "offer",
        areas: {
          tokyo: denkiPricing({
            basic: { type: "ampere", yenPerMonth: { "30": 800, "40": 1100, "50": 1400 } },
            tiers: [{ upTo: null, yenPerKwh: 21 }],
          }),
        },
      }),
      denkiPlan({
        offerId: "kansai-only",
        company: "関西限定電力",
        planName: "プランK",
        kind: "offer",
        areas: { kansai: minimumPricing },
      }),
    ],
  });

  it("エリア外のプランは含まれない", () => {
    const result = compareOffers(file, "tokyo", 300, 30);
    expect(result.map((r) => r.offerId)).not.toContain("kansai-only");
    expect(result).toHaveLength(2);
  });

  it("月額の安い順に並ぶ", () => {
    const result = compareOffers(file, "tokyo", 300, 30);
    const amounts = result.map((r) => r.monthlyYen);
    expect(amounts).toEqual([...amounts].sort((a, b) => a - b));
  });

  it("offer の diffYen は baseline との差（負 = 安い）、baseline 自身は null", () => {
    const result = compareOffers(file, "tokyo", 300, 30);
    const baseline = result.find((r) => r.kind === "baseline")!;
    const offer = result.find((r) => r.offerId === "cheap-power")!;
    expect(baseline.diffYen).toBeNull();
    expect(offer.diffYen).toBe(offer.monthlyYen - baseline.monthlyYen);
    // このフィクスチャでは 300kWh 時: baseline 8400 / offer 800+6300=7100 → 安い
    expect(offer.diffYen).toBeLessThan(0);
  });

  it("baseline がないエリアでは diffYen は null", () => {
    const result = compareOffers(file, "kansai", 100, 30);
    expect(result).toHaveLength(1);
    expect(result[0].diffYen).toBeNull();
  });
});

describe("HOUSEHOLD_KWH（世帯人数→月間使用量の目安）", () => {
  it("全世帯人数の値が現実的な範囲（実データ未投入なら落とす）", () => {
    for (const size of [1, 2, 3, 4, 5] as const) {
      expect(HOUSEHOLD_KWH[size], `${size}人世帯`).toBeGreaterThan(100);
      expect(HOUSEHOLD_KWH[size], `${size}人世帯`).toBeLessThan(1000);
    }
  });
  it("世帯人数が増えるほど使用量は単調非減少", () => {
    expect(HOUSEHOLD_KWH[1]).toBeLessThanOrEqual(HOUSEHOLD_KWH[2]);
    expect(HOUSEHOLD_KWH[2]).toBeLessThanOrEqual(HOUSEHOLD_KWH[3]);
    expect(HOUSEHOLD_KWH[3]).toBeLessThanOrEqual(HOUSEHOLD_KWH[4]);
    expect(HOUSEHOLD_KWH[4]).toBeLessThanOrEqual(HOUSEHOLD_KWH[5]);
  });
  it("出典の確認時点が入っている", () => {
    expect(HOUSEHOLD_KWH_SOURCE.asOf).toMatch(/^\d{4}/);
  });
});

describe("defaultAmpere", () => {
  it("1〜2人=30A、3人以上=40A", () => {
    expect(defaultAmpere(1)).toBe(30);
    expect(defaultAmpere(2)).toBe(30);
    expect(defaultAmpere(3)).toBe(40);
    expect(defaultAmpere(5)).toBe(40);
  });
});
