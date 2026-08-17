import { describe, it, expect } from "vitest";
import { DENKI_AREAS } from "@/lib/denki";
import { DENKI_PLANS, denkiPlansLastModified, validateDenkiPlans } from "@/lib/denkiPlans";
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

  // 実データの手入力ミス（桁・段階の取り違え）を検出するスポットチェック。
  // 期待値は各社公式の料金表（2026-08-16 確認、税込・燃調/賦課金含まず）から手計算。
  it("スポットチェック: 東京電力 従量電灯B 30A・260kWh", () => {
    const tokyo = DENKI_PLANS.plans.find((p) => p.offerId === "baseline-tokyo")!.areas.tokyo!;
    // 935.25 + 120×29.80 + 140×36.40 = 9,607.25 → 9,607
    expect(estimateMonthly(tokyo, 260, 30)).toBe(9607);
  });
  it("スポットチェック: 関西電力 従量電灯A・260kWh", () => {
    const kansai = DENKI_PLANS.plans.find((p) => p.offerId === "baseline-kansai")!.areas.kansai!;
    // 522.58 + 105×20.21 + 140×25.61 = 6,230.03 → 6,230
    expect(estimateMonthly(kansai, 260, 30)).toBe(6230);
  });
  it("スポットチェック: 北海道電力は280kWhが第2段階の上限", () => {
    const hokkaido = DENKI_PLANS.plans.find((p) => p.offerId === "baseline-hokkaido")!.areas.hokkaido!;
    expect(hokkaido.tiers[1].upTo).toBe(280);
  });
});
