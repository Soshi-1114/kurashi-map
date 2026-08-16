import { describe, it, expect } from "vitest";
import { getDenkiPlans, validateDenkiPlans, DENKI_AREAS } from "@/lib/denki";
import { estimateMonthly } from "@/lib/denkiSim";

// data/denki-plans.json（手動整備の実データ）の整合性を CI で常時検証する。
describe("data/denki-plans.json", () => {
  const file = getDenkiPlans();

  it("整合性検証を通る（baseline 全10エリア網羅・単価正・offerId 一意 など）", () => {
    expect(validateDenkiPlans(file)).toEqual([]);
  });

  it("baseline は全エリアで最低料金/基本料金と3段階従量を持つ", () => {
    for (const area of DENKI_AREAS) {
      const baseline = file.plans.find((p) => p.kind === "baseline" && p.areas[area]);
      expect(baseline, area).toBeDefined();
      expect(baseline!.areas[area]!.tiers.length, area).toBeGreaterThanOrEqual(3);
    }
  });

  it("最低料金制エリア（関西・中国・四国・沖縄）の baseline は minimum 型", () => {
    for (const area of ["kansai", "chugoku", "shikoku", "okinawa"] as const) {
      const baseline = file.plans.find((p) => p.kind === "baseline" && p.areas[area])!;
      expect(baseline.areas[area]!.basic.type, area).toBe("minimum");
    }
  });

  it("アンペア制エリアの baseline は ampere 型", () => {
    for (const area of ["hokkaido", "tohoku", "tokyo", "chubu", "hokuriku", "kyushu"] as const) {
      const baseline = file.plans.find((p) => p.kind === "baseline" && p.areas[area])!;
      expect(baseline.areas[area]!.basic.type, area).toBe("ampere");
    }
  });

  // 実データの手入力ミス（桁・段階の取り違え）を検出するスポットチェック。
  // 期待値は各社公式の料金表（2026-08-16 確認、税込・燃調/賦課金含まず）から手計算。
  it("スポットチェック: 東京電力 従量電灯B 30A・260kWh", () => {
    const tokyo = file.plans.find((p) => p.offerId === "baseline-tokyo")!.areas.tokyo!;
    // 935.25 + 120×29.80 + 140×36.40 = 9,607.25 → 9,607
    expect(estimateMonthly(tokyo, 260, 30)).toBe(9607);
  });
  it("スポットチェック: 関西電力 従量電灯A・260kWh", () => {
    const kansai = file.plans.find((p) => p.offerId === "baseline-kansai")!.areas.kansai!;
    // 522.58 + 105×20.21 + 140×25.61 = 6,230.03 → 6,230
    expect(estimateMonthly(kansai, 260, 30)).toBe(6230);
  });
  it("スポットチェック: 北海道電力は280kWhが第2段階の上限", () => {
    const hokkaido = file.plans.find((p) => p.offerId === "baseline-hokkaido")!.areas.hokkaido!;
    expect(hokkaido.tiers[1].upTo).toBe(280);
  });
});
