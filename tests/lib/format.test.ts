import { describe, it, expect } from "vitest";
import { signedPct } from "@/lib/format";

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
