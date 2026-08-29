import { describe, it, expect } from "vitest";
import { hasFiscal, isFiscalRankable, isFiscalSpecialWard, fiscalIndexText } from "@/lib/fiscal";

// 財政力指数のアクセサ。対象判定（index=-1 センチネル・未収録）と、
// 特別区（都区財政調整制度下の算定）のランキング除外を守る。
describe("fiscal", () => {
  const fiscal = { index: 0.7, source: "総務省 地方公共団体の主要財政指標一覧", asOf: "2024年度" };
  const specialWard = {
    index: 0.85,
    source: "総務省 地方公共団体の主要財政指標一覧（特別区・都区財政調整制度下の算定）",
    asOf: "2024年度",
  };
  const nodata = { index: -1, source: "データなし（対象外）", asOf: "-" };

  it("hasFiscal: 実データは真、-1センチネル・未収録は偽", () => {
    expect(hasFiscal(fiscal)).toBe(true);
    expect(hasFiscal(specialWard)).toBe(true); // 特別区も実データ（表示はする）
    expect(hasFiscal(nodata)).toBe(false);
    expect(hasFiscal(undefined)).toBe(false);
  });

  it("isFiscalRankable: 特別区は実データだがランキング対象外", () => {
    expect(isFiscalRankable(fiscal)).toBe(true);
    expect(isFiscalRankable(specialWard)).toBe(false);
    expect(isFiscalRankable(nodata)).toBe(false);
  });

  it("isFiscalSpecialWard は source の都区財政調整の文言で判定する", () => {
    expect(isFiscalSpecialWard(specialWard)).toBe(true);
    expect(isFiscalSpecialWard(fiscal)).toBe(false);
    expect(isFiscalSpecialWard(undefined)).toBe(false);
  });

  it("fiscalIndexText は小数2桁、データなしは —", () => {
    expect(fiscalIndexText(fiscal)).toBe("0.70");
    expect(fiscalIndexText(nodata)).toBe("—");
  });
});
