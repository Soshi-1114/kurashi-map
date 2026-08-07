import { describe, it, expect } from "vitest";
import { signedPct, barWidthPct } from "@/lib/format";

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
