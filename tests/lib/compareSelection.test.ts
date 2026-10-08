import { describe, expect, it } from "vitest";
import { normalizeCompareCandidates } from "@/lib/compareSelection";

describe("normalizeCompareCandidates", () => {
  const candidate = (code: string, source = "area_detail") => ({ code, name: `街${code}`, pref: "埼玉県", source });

  it("不正値・重複を除いて最大3件にする", () => {
    expect(normalizeCompareCandidates([
      null,
      candidate("abcde"),
      candidate("11201"),
      candidate("11201"),
      candidate("11202"),
      candidate("11203"),
      candidate("11204"),
    ]).map((item) => item.code)).toEqual(["11201", "11202", "11203"]);
  });

  it("空の表示値を捨て、未知の送客元を許可済み値へ戻す", () => {
    expect(normalizeCompareCandidates([
      { ...candidate("11201"), name: "  " },
      candidate("11202", "unexpected"),
    ])).toEqual([{ ...candidate("11202", "home"), source: "home" }]);
  });

  it("長いラベルを保存上限内に丸める", () => {
    const [item] = normalizeCompareCandidates([{ ...candidate("11201"), name: "街".repeat(100), pref: "県".repeat(50) }]);
    expect(item.name).toHaveLength(80);
    expect(item.pref).toHaveLength(40);
  });
});
