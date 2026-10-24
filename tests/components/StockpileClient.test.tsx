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
  it("入力範囲外の水を検出し、以前の値で足りていると表示しない", () => {
    render(<StockpileClient />);
    fireEvent.change(screen.getByLabelText("家庭の人数"), { target: { value: "1" } });
    const input = screen.getByLabelText("家にある水（L）");
    fireEvent.change(input, { target: { value: "30" } });
    expect(screen.getByText("入力した水の量は目安を満たしています。")).toBeTruthy();
    fireEvent.change(input, { target: { value: "10001" } });
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByText("入力した水の量は目安を満たしています。")).toBeNull();
    expect(JSON.parse(localStorage.getItem(STOCKPILE_KEY)!).water).toBeNull();
    fireEvent.change(input, { target: { value: "8.99" } });
    expect(screen.queryByRole("alert")).toBeNull();
    expect((input as HTMLInputElement).value).toBe("8.99");
  });
  it("リスト表示の連打で計測を重複させず、入力値をGA4へ送らない", () => {
    render(<StockpileClient />);
    fireEvent.change(screen.getByLabelText("家庭の人数"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("家にある水（L）"), { target: { value: "8" } });
    const button = screen.getByRole("button", { name: "買い足し・確認リストを見る" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    const calls = vi.mocked(window.gtag!).mock.calls;
    expect(calls.filter(call => call[1] === "stockpile_list_view")).toHaveLength(1);
    for (const call of calls) {
      expect(Object.keys(call[2] ?? {}).every(key => ["measurement_version", "entry_placement", "needed_count", "unchecked_count"].includes(key))).toBe(true);
    }
  });
  it("再訪で復元し、確認後に保存内容をリセットする", () => {
    localStorage.setItem(STOCKPILE_KEY, JSON.stringify({ ...emptyStockpile(), people: 3, water: 12 }));
    render(<StockpileClient />);
    expect((screen.getByLabelText("家庭の人数") as HTMLSelectElement).value).toBe("3");
    fireEvent.click(screen.getByRole("button", { name: "入力・保存内容をリセット" }));
    fireEvent.click(screen.getByRole("button", { name: "リセットする", exact: true }));
    expect((screen.getByLabelText("家庭の人数") as HTMLSelectElement).value).toBe("");
    expect(localStorage.getItem(STOCKPILE_KEY)).toBeNull();
  });
  it("開くだけでは将来形式や破損した保存内容を上書きしない", () => {
    const raw = JSON.stringify({ version: 2, people: 4, futureField: "keep" });
    localStorage.setItem(STOCKPILE_KEY, raw);
    const writes = vi.spyOn(Storage.prototype, "setItem");
    render(<StockpileClient />);
    expect(writes).not.toHaveBeenCalled();
    expect(localStorage.getItem(STOCKPILE_KEY)).toBe(raw);
    fireEvent.change(screen.getByLabelText("家庭の人数"), { target: { value: "2" } });
    expect(JSON.parse(localStorage.getItem(STOCKPILE_KEY)!).people).toBe(2);
  });
  it("保存失敗から復帰したら表示も更新する", () => {
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => { throw new Error("full"); });
    render(<StockpileClient />);
    fireEvent.change(screen.getByLabelText("家庭の人数"), { target: { value: "2" } });
    expect(screen.getByText(/保存できませんでした/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("備える日数"), { target: { value: "3" } });
    expect(screen.queryByText(/保存できませんでした/)).toBeNull();
    expect(write).toHaveBeenCalledTimes(2);
  });
  it("保存内容の削除失敗を、リセット成功として表示しない", () => {
    const saved = JSON.stringify({ ...emptyStockpile(), people: 2 });
    localStorage.setItem(STOCKPILE_KEY, saved);
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("blocked"); });
    render(<StockpileClient />);
    fireEvent.click(screen.getByRole("button", { name: "入力・保存内容をリセット" }));
    fireEvent.click(screen.getByRole("button", { name: "リセットする", exact: true }));
    expect(screen.getByText(/保存内容を削除できませんでした/)).toBeTruthy();
    expect(localStorage.getItem(STOCKPILE_KEY)).toBe(saved);
  });
  it("保存不可でも計算でき、コピー失敗時はテキストを残す", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error("blocked")) } });
    render(<StockpileClient />);
    fireEvent.change(screen.getByLabelText("家庭の人数"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "買い足し・確認リストを見る" }));
    fireEvent.click(screen.getByRole("button", { name: "リストをコピー" }));
    await waitFor(() => expect(screen.getByText(/コピーできませんでした/)).toBeTruthy());
    expect(screen.getByLabelText("コピー用の備蓄リスト").closest("details")?.open).toBe(true);
    expect((screen.getByLabelText("コピー用の備蓄リスト") as HTMLTextAreaElement).value).toContain("1人・7日分");
  });
});
