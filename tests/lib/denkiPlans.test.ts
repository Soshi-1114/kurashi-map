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

  // ===== offer（新電力）の収録状態 =====

  it("沖縄以外の全エリアに offer が1社以上ある（リンク0本=比較不能への退行防止）", () => {
    for (const area of DENKI_AREAS) {
      const offers = DENKI_PLANS.plans.filter((p) => p.kind === "offer" && p.areas[area]);
      if (area === "okinawa") {
        // 沖縄は調査時点（2026-08）で固定単価公表の新電力提供なし。提供が始まったらこの分岐を外す。
        expect(offers.length, area).toBe(0);
      } else {
        expect(offers.length, area).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("最低料金制エリアの offer も minimum 型（UI がアンペアを聞かないエリアで ampere 型を混ぜない）", () => {
    for (const area of ["kansai", "chugoku", "shikoku"] as const) {
      for (const p of DENKI_PLANS.plans.filter((p) => p.kind === "offer" && p.areas[area])) {
        expect(p.areas[area]!.basic.type, `${p.offerId}/${area}`).toBe("minimum");
      }
    }
  });

  // offer のスポットチェック。期待値は各社公式の料金表（2026-08-18 確認、税込・燃調/賦課金含まず）
  // から手計算。転記ミス（桁・段階境界・エリア取り違え）の検出が目的。
  it("スポットチェック: ENEOSでんき 東京Vプラン 30A・260kWh", () => {
    const p = DENKI_PLANS.plans.find((p) => p.offerId === "eneos-v")!.areas.tokyo!;
    // 935.25 + 120×29.80 + 140×34.85 = 9,390.25 → 9,390
    expect(estimateMonthly(p, 260, 30)).toBe(9390);
  });
  it("スポットチェック: idemitsuでんき Sプラン 関西・260kWh", () => {
    const p = DENKI_PLANS.plans.find((p) => p.offerId === "idemitsu-s")!.areas.kansai!;
    // 522.58 + 105×20.21 + 140×24.24 = 6,038.23 → 6,038
    expect(estimateMonthly(p, 260, 30)).toBe(6038);
  });
  it("スポットチェック: TERASELプラン 北海道 40A・300kWh", () => {
    const p = DENKI_PLANS.plans.find((p) => p.offerId === "terasel-b")!.areas.hokkaido!;
    // 1,617.44 + 120×34.74 + 160×40.78 + 20×44.35 = 13,198.04 → 13,198
    expect(estimateMonthly(p, 300, 40)).toBe(13198);
  });
  it("スポットチェック: 超TERASELプラン 四国・260kWh", () => {
    const p = DENKI_PLANS.plans.find((p) => p.offerId === "terasel-cho")!.areas.shikoku!;
    // 667.00 + 109×30.66 + 140×36.08 = 9,060.14 → 9,060
    expect(estimateMonthly(p, 260, 30)).toBe(9060);
  });
  it("スポットチェック: ミツウロコでんき 九州 50A・430kWh", () => {
    const p = DENKI_PLANS.plans.find((p) => p.offerId === "mitsuuroko-juryo")!.areas.kyushu!;
    // 1,581.20 + 120×20.39 + 180×20.52 + 130×24.24 = 10,872.80 → 10,873
    expect(estimateMonthly(p, 430, 50)).toBe(10873);
  });
});
