// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import StockpileClient from "@/components/bousai/StockpileClient";
import { STOCKPILE_KEY, emptyStockpile } from "@/lib/stockpile";
beforeEach(() => { localStorage.clear(); window.gtag = vi.fn(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); delete window.gtag; });
describe("備蓄チェックの操作", () => {
  it("人数未選択では計算せず、入力から不足量・リスト・コピーまで利用できる", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<StockpileClient />);
    expect(screen.queryByLabelText("家にある水（L）")).toBeNull();
    fireEvent.change(screen.getByLabelText("家庭の人数"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("備える日数"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("家にある水（L）"), { target: { value: "8" } });
    expect(screen.getByText("あと10L（2Lボトルなら5本）")).toBeTruthy();
    const food = screen.getByRole("group", { name: "普段食べる食品" });
    fireEvent.click(within(food).getByLabelText("要準備"));
    fireEvent.click(screen.getByRole("button", { name: "買い足し・確認リストを見る" }));
    fireEvent.click(screen.getByRole("button", { name: "リストをコピー" }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0][0]).toContain("2人・3日分");
    expect(JSON.parse(localStorage.getItem(STOCKPILE_KEY)!).water).toBe(8);
    expect(window.gtag).toHaveBeenCalledWith("event", "stockpile_copy", { measurement_version: "2026-10-24", entry_placement: "direct" });
    fireEvent.change(screen.getByLabelText("備える日数"), { target: { value: "7" } });
    expect((within(food).getByLabelText("未確認") as HTMLInputElement).checked).toBe(true);
  });
  it("再訪で復元し、確認後に保存内容をリセットする", () => {
    localStorage.setItem(STOCKPILE_KEY, JSON.stringify({ ...emptyStockpile(), people: 3, water: 12 }));
    render(<StockpileClient />);
    expect((screen.getByLabelText("家庭の人数") as HTMLSelectElement).value).toBe("3");
    fireEvent.click(screen.getByRole("button", { name: "入力・保存内容をリセット" }));
    fireEvent.click(screen.getByRole("button", { name: "リセットする", exact: true }));
    expect((screen.getByLabelText("家庭の人数") as HTMLSelectElement).value).toBe("");
    expect(JSON.parse(localStorage.getItem(STOCKPILE_KEY)!)).toEqual(emptyStockpile());
  });
  it("保存不可でも計算でき、コピー失敗時はテキストを残す", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error("blocked")) } });
    render(<StockpileClient />);
    fireEvent.change(screen.getByLabelText("家庭の人数"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "買い足し・確認リストを見る" }));
    fireEvent.click(screen.getByRole("button", { name: "リストをコピー" }));
    await waitFor(() => expect(screen.getByText(/コピーできませんでした/)).toBeTruthy());
    expect((screen.getByLabelText("コピー用の備蓄リスト") as HTMLTextAreaElement).value).toContain("1人・7日分");
  });
});
