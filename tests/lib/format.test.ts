import { describe, it, expect } from "vitest";
import { signedPct, barWidthPct, compactPopulation, compactYen } from "@/lib/format";

describe("signedPct", () => {
  it("正の値には + を付ける", () => {
    expect(signedPct(3.2)).toBe("+3.2");
  });

  it("負の値はそのまま", () => {
    expect(signedPct(-1.5)).toBe("-1.5");
  });

  it("0はそのまま（符号なし）", () => {
    expect(signedPct(0)).toBe("0.0");
  });

  it("丸めるとちょうど0になる負の極小値は「-0.0」にならず「0.0」を返す", () => {
    expect(signedPct(-0.00556)).toBe("0.0");
  });

  it("丸めるとちょうど0になる正の極小値も「+0.0」にならず「0.0」を返す", () => {
    expect(signedPct(0.004)).toBe("0.0");
  });

  it("桁数指定を尊重する", () => {
    expect(signedPct(3.14159, 2)).toBe("+3.14");
  });
});

describe("barWidthPct", () => {
  it("最大値のときは100%", () => {
    expect(barWidthPct(100, 100)).toBe(100);
  });

  it("極小値でも最小4%を保証する（視認性のため）", () => {
    expect(barWidthPct(0, 100)).toBe(4);
    expect(barWidthPct(1, 10000)).toBe(4);
  });

  it("比率どおりの幅を返す", () => {
    expect(barWidthPct(50, 100)).toBe(50);
  });
});

describe("compactPopulation", () => {
  it("1万人未満は実数のまま", () => {
    expect(compactPopulation(3456)).toBe("3,456人");
    expect(compactPopulation(9999)).toBe("9,999人");
  });

  it("1万人以上100万人未満は小数1桁の万人", () => {
    expect(compactPopulation(10000)).toBe("1.0万人");
    expect(compactPopulation(695043)).toBe("69.5万人");
  });

  it("100万人以上は小数を落とす（可読性のため）", () => {
    expect(compactPopulation(1096951)).toBe("110万人");
  });

  it("人口0（北方領土等の対象外）でも壊れない", () => {
    expect(compactPopulation(0)).toBe("0人");
  });
});

describe("compactYen", () => {
  it("1万円未満は実数のまま", () => {
    expect(compactYen(9500)).toBe("9,500円");
  });

  it("1万円以上は小数1桁の万円", () => {
    expect(compactYen(78000)).toBe("7.8万円");
    expect(compactYen(130000)).toBe("13.0万円");
  });
});
