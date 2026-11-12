// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StockpileEntry from "@/components/bousai/StockpileEntry";
import { DenkiTeaser } from "@/components/area/DenkiTeaser";
import { takeQuickEntry } from "@/lib/quickEntry";

beforeEach(() => { sessionStorage.clear(); window.gtag = vi.fn(); vi.stubEnv("NEXT_PUBLIC_QUICK_ENTRY_V2", "true"); });
afterEach(() => { cleanup(); vi.unstubAllEnvs(); delete window.gtag; });
describe("評価後に有効化する人数ボタン版", () => {
  it("表示だけでは結果を計測せず、電気の選択と詳細への条件引き継ぎを保つ", () => {
    render(<DenkiTeaser municipalityCode="13101" municipalityName="千代田区" />);
    expect(window.gtag).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "2人" }));
    expect(screen.getByRole("button", { name: "2人" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("status").textContent).toContain("円");
    fireEvent.click(screen.getByRole("button", { name: "3人" }));
    const resultCalls = vi.mocked(window.gtag!).mock.calls.filter(c => c[1] === "denki_quick_result_view");
    expect(resultCalls).toHaveLength(1);
    expect(resultCalls[0][2]).toMatchObject({ measurement_version: "2026-11-12", cta_variant: "people-buttons-v2" });
    expect(resultCalls[0][2]).not.toHaveProperty("people");
    fireEvent.click(screen.getByRole("link", { name: "使用量を変えて詳しく試算する" }));
    expect(takeQuickEntry("denki", "?code=13101&from=area_detail&quick=1")).toMatchObject({ people: 3 });
  });

  it("備蓄は6人以上・日数変更に対応し、結果と引き継ぎが一致する", () => {
    render(<StockpileEntry placement="area" />);
    fireEvent.change(screen.getByLabelText("備蓄を調べる家庭の人数（6人以上）"), { target: { value: "6" } });
    expect(screen.getByRole("status").textContent).toContain("126L");
    fireEvent.change(screen.getByLabelText("備蓄を調べる日数"), { target: { value: "3" } });
    expect(screen.getByRole("status").textContent).toContain("54L");
    fireEvent.click(screen.getByRole("link", { name: "食品・日用品もチェックする" }));
    expect(takeQuickEntry("stockpile", "?from=area&quick=1")).toMatchObject({ people: 6, days: 3 });
    expect(window.gtag).toHaveBeenCalledWith("event", "stockpile_quick_result_view", expect.objectContaining({ cta_variant: "water-buttons-v2" }));
  });

  it("フラグ無効時は既存の入力と計測版を維持する", () => {
    vi.stubEnv("NEXT_PUBLIC_QUICK_ENTRY_V2", "false");
    render(<StockpileEntry placement="area" />);
    expect(screen.queryByRole("button", { name: "2人" })).toBeNull();
    fireEvent.change(screen.getByLabelText("備蓄を調べる家庭の人数"), { target: { value: "2" } });
    expect(window.gtag).toHaveBeenCalledWith("event", "stockpile_quick_result_view", expect.objectContaining({ measurement_version: "2026-10-31", cta_variant: "water-inline-v1" }));
  });
});
