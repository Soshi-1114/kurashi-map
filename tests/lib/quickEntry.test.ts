// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { saveQuickEntry, takeQuickEntry } from "@/lib/quickEntry";
const draft = { tool: "denki", people: 4, area: "chubu", code: "22210", from: "area_detail" } as const;
const search = "?code=22210&from=area_detail&quick=1";
beforeEach(() => sessionStorage.clear());
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
describe("入口の一時入力", () => {
  it("明示された同じ入口からのみ一度引き継ぐ", () => {
    saveQuickEntry(draft);
    expect(takeQuickEntry("denki", "?code=22210&from=area_detail")).toBeNull();
    expect(takeQuickEntry("denki", search)).toEqual(draft);
    expect(takeQuickEntry("denki", search)).toBeNull();
  });
  it("別自治体・別送客元・期限切れ・壊れたデータを使わない", () => {
    saveQuickEntry(draft);
    expect(takeQuickEntry("denki", search.replace("22210", "13101"))).toBeNull();
    saveQuickEntry(draft);
    expect(takeQuickEntry("denki", search.replace("area_detail", "header"))).toBeNull();
    vi.useFakeTimers();
    saveQuickEntry(draft);
    vi.advanceTimersByTime(30 * 60 * 1000 + 1);
    expect(takeQuickEntry("denki", search)).toBeNull();
    sessionStorage.setItem("kurashimap-quick-denki-v1", "broken");
    expect(takeQuickEntry("denki", search)).toBeNull();
  });
  it("ストレージが使えなくても例外を漏らさない", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(() => saveQuickEntry(draft)).not.toThrow();
    expect(takeQuickEntry("denki", search)).toBeNull();
  });
});
