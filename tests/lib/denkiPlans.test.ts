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

  it("今回の収録対象では沖縄の offer は0件", () => {
    expect(DENKI_PLANS.plans.filter((p) => p.kind === "offer" && p.areas.okinawa).length).toBe(0);
  });

  // 実データの転記ミス（桁・段階境界・エリアの取り違え）を検出するスポットチェック。
  // 期待値は各社公式の料金表（各プランの sourceAsOf 時点、税込・燃調/賦課金含まず）から手計算。
  const pricingOf = (offerId: string, area: DenkiArea) =>
    DENKI_PLANS.plans.find((p) => p.offerId === offerId)!.areas[area]!;

  it.each<{ name: string; offerId: string; area: DenkiArea; kwh: number; ampere: Ampere; expected: number }>([
    // 2026-11-11に各公式表を照合。式は円未満を最後に四捨五入。
    // 1176.18 + 120×29.85 + 140×36.45 = 9861.18
    { name: "東京電力 従量電灯B（東京）30A・260kWh", offerId: "baseline-tokyo", area: "tokyo", kwh: 260, ampere: 30, expected: 9861 },
    // 763.81 + 105×20.89 + 140×26.29 = 6637.86
    { name: "関西電力 従量電灯A（関西）260kWh", offerId: "baseline-kansai", area: "kansai", kwh: 260, ampere: 30, expected: 6638 },
    // 1176.18 + 120×29.85 + 140×34.90 = 9644.18
    { name: "ENEOSでんき Vプラン（東京）30A・260kWh", offerId: "eneos-v", area: "tokyo", kwh: 260, ampere: 30, expected: 9644 },
    // 763.81 + 105×20.89 + 140×24.92 = 6446.06
    { name: "idemitsuでんき SプランA（関西）260kWh", offerId: "idemitsu-s", area: "kansai", kwh: 260, ampere: 30, expected: 6446 },
    // 2233.84 + 120×34.82 + 160×40.86 + 20×44.43 = 13838.44
    { name: "TERASELでんき TERASELプラン（北海道）40A・300kWh", offerId: "terasel-b", area: "hokkaido", kwh: 300, ampere: 40, expected: 13838 },
    // 953.13 + 109×31.42 + 140×36.85 = 9536.91
    { name: "TERASELでんき 超TERASELプラン（四国）260kWh", offerId: "terasel-cho", area: "shikoku", kwh: 260, ampere: 30, expected: 9537 },
    // 2208.45 + 120×20.35 + 180×20.48 + 130×24.20 = 11482.85
    { name: "ミツウロコでんき 従量電灯B（九州）50A・430kWh", offerId: "mitsuuroko-juryo", area: "kyushu", kwh: 430, ampere: 50, expected: 11483 },
    // 1716.30 + 120×35.77 + 160×42.06 + 20×45.78 = 13653.90
    { name: "北海道電力 従量電灯B 30A・300kWh", offerId: "baseline-hokkaido", area: "hokkaido", kwh: 300, ampere: 30, expected: 13654 },
    // 1642.84 + 120×31.01 + 180×37.76 + 100×41.71 = 16331.84
    { name: "東北電力 従量電灯B 40A・400kWh", offerId: "baseline-tohoku", area: "tohoku", kwh: 400, ampere: 40, expected: 16332 },
    // 2239.60 + 120×21.25 + 180×25.73 + 100×28.68 = 12289.00
    { name: "中部電力 従量電灯B 50A・400kWh", offerId: "baseline-chubu", area: "chubu", kwh: 400, ampere: 50, expected: 12289 },
    // 907.50 + 120×30.86 + 180×34.75 + 100×36.46 = 14511.70（ネクストと区別）
    { name: "北陸電力 従量電灯B 30A・400kWh", offerId: "baseline-hokuriku", area: "hokuriku", kwh: 400, ampere: 30, expected: 14512 },
    // 983.37 + 105×33.32 + 180×40.00 + 100×42.12 = 15893.97
    { name: "中国電力 従量電灯A 400kWh", offerId: "baseline-chugoku", area: "chugoku", kwh: 400, ampere: 30, expected: 15894 },
    // 953.13 + 109×31.42 + 180×38.04 + 100×41.55 = 15380.11
    { name: "四国電力 従量電灯A 400kWh", offerId: "baseline-shikoku", area: "shikoku", kwh: 400, ampere: 30, expected: 15380 },
    // 1325.07 + 120×18.33 + 180×23.93 + 100×26.93 = 10525.07
    { name: "九州電力 従量電灯B 30A・400kWh", offerId: "baseline-kyushu", area: "kyushu", kwh: 400, ampere: 30, expected: 10525 },
    // 767.82 + 110×42.06 + 180×47.60 + 100×49.58 = 18920.42
    { name: "沖縄電力 従量電灯 400kWh", offerId: "baseline-okinawa", area: "okinawa", kwh: 400, ampere: 30, expected: 18920 },
    // 1096.44 + 120×31.39 + 180×31.89 + 100×36.14 = 14217.44
    { name: "東急でんき 従量電灯B 30A・400kWh", offerId: "tokyu-b", area: "tokyo", kwh: 400, ampere: 30, expected: 14217 },
    // 873.37 + 105×33.32 + 140×39.06 = 9840.37（大手の最低料金とは異なる）
    { name: "idemitsuでんき SプランA（中国）260kWh", offerId: "idemitsu-s", area: "chugoku", kwh: 260, ampere: 30, expected: 9840 },
  ])("スポットチェック: $name", ({ offerId, area, kwh, ampere, expected }) => {
    expect(estimateMonthly(pricingOf(offerId, area), kwh, ampere)).toBe(expected);
  });

  it("スポットチェック: 北海道電力は280kWhが第2段階の上限", () => {
    expect(pricingOf("baseline-hokkaido", "hokkaido").tiers[1].upTo).toBe(280);
  });
});
