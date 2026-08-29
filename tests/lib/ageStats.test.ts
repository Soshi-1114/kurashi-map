import { describe, it, expect } from "vitest";
import {
  hasAgeData, elderlyRatioPct, youngRatioPct, elderlyRatioText, youngRatioText,
} from "@/lib/ageStats";

// 年齢構成（住基台帳）のアクセサ。対象判定（総人口0のセンチネル・未収録）と
// 実行時算出の比率（派生値は保存しない方針）を守る。
describe("ageStats", () => {
  const stats = {
    young: 120_000,
    elderly: 180_000,
    total: 600_000,
    source: "総務省 住民基本台帳に基づく人口・世帯数調査（総計・外国人住民含む）",
    asOf: "2026-01-01",
  };

  it("hasAgeData: 実データは真、total=0 センチネル・未収録は偽", () => {
    expect(hasAgeData(stats)).toBe(true);
    expect(hasAgeData({ ...stats, young: 0, elderly: 0, total: 0 })).toBe(false);
    expect(hasAgeData(undefined)).toBe(false);
  });

  it("高齢化率・年少人口比は住基総人口を分母に実行時算出する", () => {
    expect(elderlyRatioPct(stats)).toBeCloseTo(30);
    expect(youngRatioPct(stats)).toBeCloseTo(20);
    expect(elderlyRatioPct(undefined)).toBeNull();
    expect(youngRatioPct({ ...stats, total: 0 })).toBeNull();
  });

  it("表示テキストは小数1桁%、データなしは —", () => {
    expect(elderlyRatioText(stats)).toBe("30.0%");
    expect(youngRatioText(stats)).toBe("20.0%");
    expect(elderlyRatioText(undefined)).toBe("—");
  });

  it("高齢者0人（理論上の実データ）は 0.0% であってデータなしではない", () => {
    const zero = { ...stats, elderly: 0 };
    expect(elderlyRatioPct(zero)).toBe(0);
    expect(elderlyRatioText(zero)).toBe("0.0%");
  });
});
