import { describe, it, expect } from "vitest";
import { emptyStockpile, parseStockpile, stockpileLists, stockpileText, waterAmounts } from "@/lib/stockpile";
describe("家庭備蓄", () => {
  it("水の必要量・不足量・余剰・未確認を区別する", () => {
    expect(waterAmounts(2, 3, 8)).toEqual({ required: 18, shortage: 10 });
    expect(waterAmounts(1, 7, null)).toEqual({ required: 21, shortage: null });
    expect(waterAmounts(1, 3, 30).shortage).toBe(0);
    expect(waterAmounts(1, 3, 8.8).shortage).toBe(0.2);
  });
  it("保存状態を検証し、不正・旧形式・範囲外は復元しない", () => {
    const state = { ...emptyStockpile(), people: 2, water: 8, statuses: { food: "needed" } };
    expect(parseStockpile(JSON.stringify(state))).toEqual(state);
    for (const patch of [{ version: 2 }, { people: 0 }, { people: 1.5 }, { people: 21 }, { days: 4 }, { water: -1 }, { water: "2" }, { statuses: { food: "invalid" } }]) {
      expect(parseStockpile(JSON.stringify({ ...state, ...patch }))).toBeNull();
    }
    expect(parseStockpile("invalid")).toBeNull();
    expect(parseStockpile("null")).toBeNull();
  });
  it("買い足す物と未確認を分け、準備済みはリストから除く", () => {
    const state = { ...emptyStockpile(), people: 2, days: 3 as const, water: 8, statuses: { food: "needed" as const, light: "ready" as const } };
    const lists = stockpileLists(state);
    expect(lists.needed).toContain("飲料・調理用の水：あと10L（2Lボトルなら5本）");
    expect(lists.needed).toContain("普段食べる食品");
    expect(lists.unknown).not.toContain("照明・予備電池");
    expect(stockpileText(state)).toContain("2人・3日分");
    expect(stockpileText(state)).toContain("https://www.maff.go.jp/");
  });
});
