import { describe, it, expect } from "vitest";
import { DENKI_AREAS, type DenkiArea } from "@/lib/denki";
import { DENKI_PLANS, denkiPlansLastModified, validateDenkiPlans, type Ampere } from "@/lib/denkiPlans";
import { estimateMonthly } from "@/lib/denkiSim";
import { denkiPricing, denkiPlan, denkiPlansFile } from "../_fixtures";

describe("validateDenkiPlans", () => {
  const allAreas = () =>
    denkiPlansFile({
      plans: [denkiPlan({ areas: Object.fromEntries(DENKI_AREAS.map((a) => [a, denkiPricing()])) })],
    });

  it("正しいファイルはエラーなし", () => {
    expect(validateDenkiPlans(allAreas())).toEqual([]);
  });
  it("baseline が欠けるエリアを検出", () => {
    const f = allAreas();
    delete f.plans[0].areas.okinawa;
    expect(validateDenkiPlans(f).join("\n")).toContain("okinawa の baseline がない");
  });
  it("offerId 重複を検出", () => {
    const f = allAreas();
    f.plans.push({ ...f.plans[0], kind: "offer" });
    expect(validateDenkiPlans(f).join("\n")).toContain("重複");
  });
  it("同一エリアで basic.type の混在を検出（アンペア制/最低料金制はエリアの属性）", () => {
    const f = allAreas();
    f.plans.push(
      denkiPlan({
        offerId: "offer-mixed",
        kind: "offer",
        areas: {
          tokyo: denkiPricing({ basic: { type: "minimum", yenPerMonth: 500, includedKwh: 15 } }),
        },
      }),
    );
    expect(validateDenkiPlans(f).join("\n")).toContain("basic.type が混在");
  });
  it("単価 0 を検出", () => {
    const f = allAreas();
    f.plans[0].areas.tokyo = denkiPricing({ tiers: [{ upTo: null, yenPerKwh: 0 }] });
    expect(validateDenkiPlans(f).join("\n")).toContain("単価が正でない");
  });
  it("段階の upTo が昇順でないのを検出", () => {
    const f = allAreas();
    f.plans[0].areas.tokyo = denkiPricing({
      tiers: [
        { upTo: 300, yenPerKwh: 20 },
        { upTo: 120, yenPerKwh: 25 },
        { upTo: null, yenPerKwh: 28 },
      ],
    });
    expect(validateDenkiPlans(f).join("\n")).toContain("昇順でない");
  });
  it("最終段階の upTo が null でないのを検出", () => {
    const f = allAreas();
    f.plans[0].areas.tokyo = denkiPricing({ tiers: [{ upTo: 120, yenPerKwh: 20 }] });
    expect(validateDenkiPlans(f).join("\n")).toContain("null であるべき");
  });
  it("asOf の形式違反を検出", () => {
    expect(validateDenkiPlans(denkiPlansFile({ asOf: "2026/08" })).join("\n")).toContain("YYYY-MM");
  });
});

// data/denki-plans.json（手動整備の実データ）の整合性を CI で常時検証する。
describe("data/denki-plans.json", () => {
  it("整合性検証を通る（baseline 全10エリア網羅・単価正・offerId 一意 など）", () => {
    expect(validateDenkiPlans(DENKI_PLANS)).toEqual([]);
  });

  it("baseline は全エリアで3段階以上の従量を持つ", () => {
    for (const area of DENKI_AREAS) {
      const baseline = DENKI_PLANS.plans.find((p) => p.kind === "baseline" && p.areas[area])!;
      expect(baseline.areas[area]!.tiers.length, area).toBeGreaterThanOrEqual(3);
    }
  });

  it("最低料金制エリア（関西・中国・四国・沖縄）の baseline は minimum 型", () => {
    for (const area of ["kansai", "chugoku", "shikoku", "okinawa"] as const) {
      const baseline = DENKI_PLANS.plans.find((p) => p.kind === "baseline" && p.areas[area])!;
      expect(baseline.areas[area]!.basic.type, area).toBe("minimum");
    }
  });

  it("アンペア制エリアの baseline は ampere 型", () => {
    for (const area of ["hokkaido", "tohoku", "tokyo", "chubu", "hokuriku", "kyushu"] as const) {
      const baseline = DENKI_PLANS.plans.find((p) => p.kind === "baseline" && p.areas[area])!;
      expect(baseline.areas[area]!.basic.type, area).toBe("ampere");
    }
  });

  it("asOf から sitemap 用の lastModified を導出できる", () => {
    const d = denkiPlansLastModified();
    expect(Number.isNaN(d.getTime())).toBe(false);
  });

  it("沖縄以外の全エリアに offer が1社以上ある（リンク0本=比較不能への退行防止）", () => {
    for (const area of DENKI_AREAS.filter((a) => a !== "okinawa")) {
      const offers = DENKI_PLANS.plans.filter((p) => p.kind === "offer" && p.areas[area]);
      expect(offers.length, area).toBeGreaterThanOrEqual(1);
    }
  });

  it("沖縄は offer 0件（調査時点 2026-08 で固定単価公表の新電力提供なし。提供が始まったらこのテストを外す）", () => {
    expect(DENKI_PLANS.plans.filter((p) => p.kind === "offer" && p.areas.okinawa).length).toBe(0);
  });

  // 実データの転記ミス（桁・段階境界・エリアの取り違え）を検出するスポットチェック。
  // 期待値は各社公式の料金表（各プランの sourceAsOf 時点、税込・燃調/賦課金含まず）から手計算。
  const pricingOf = (offerId: string, area: DenkiArea) =>
    DENKI_PLANS.plans.find((p) => p.offerId === offerId)!.areas[area]!;

  it.each<{ name: string; offerId: string; area: DenkiArea; kwh: number; ampere: Ampere; expected: number }>([
    // 935.25 + 120×29.80 + 140×36.40 = 9,607.25 → 9,607
    { name: "東京電力 従量電灯B（東京）30A・260kWh", offerId: "baseline-tokyo", area: "tokyo", kwh: 260, ampere: 30, expected: 9607 },
    // 522.58 + 105×20.21 + 140×25.61 = 6,230.03 → 6,230
    { name: "関西電力 従量電灯A（関西）260kWh", offerId: "baseline-kansai", area: "kansai", kwh: 260, ampere: 30, expected: 6230 },
    // 935.25 + 120×29.80 + 140×34.85 = 9,390.25 → 9,390
    { name: "ENEOSでんき Vプラン（東京）30A・260kWh", offerId: "eneos-v", area: "tokyo", kwh: 260, ampere: 30, expected: 9390 },
    // 522.58 + 105×20.21 + 140×24.24 = 6,038.23 → 6,038
    { name: "idemitsuでんき Sプラン（関西）260kWh", offerId: "idemitsu-s", area: "kansai", kwh: 260, ampere: 30, expected: 6038 },
    // 1,617.44 + 120×34.74 + 160×40.78 + 20×44.35 = 13,198.04 → 13,198
    { name: "TERASELでんき TERASELプラン（北海道）40A・300kWh", offerId: "terasel-b", area: "hokkaido", kwh: 300, ampere: 40, expected: 13198 },
    // 667.00 + 109×30.66 + 140×36.08 = 9,060.14 → 9,060
    { name: "TERASELでんき 超TERASELプラン（四国）260kWh", offerId: "terasel-cho", area: "shikoku", kwh: 260, ampere: 30, expected: 9060 },
    // 1,581.20 + 120×20.39 + 180×20.52 + 130×24.24 = 10,872.80 → 10,873
    { name: "ミツウロコでんき 従量電灯B（九州）50A・430kWh", offerId: "mitsuuroko-juryo", area: "kyushu", kwh: 430, ampere: 50, expected: 10873 },
  ])("スポットチェック: $name", ({ offerId, area, kwh, ampere, expected }) => {
    expect(estimateMonthly(pricingOf(offerId, area), kwh, ampere)).toBe(expected);
  });

  it("スポットチェック: 北海道電力は280kWhが第2段階の上限", () => {
    expect(pricingOf("baseline-hokkaido", "hokkaido").tiers[1].upTo).toBe(280);
  });
});
