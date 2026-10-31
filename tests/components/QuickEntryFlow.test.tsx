// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import StockpileEntry from "@/components/bousai/StockpileEntry";
import DenkiSimulator from "@/components/denki/DenkiSimulator";
import { saveQuickEntry, takeQuickEntry } from "@/lib/quickEntry";
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(window.location.search) }));
beforeEach(() => { sessionStorage.clear(); window.gtag = vi.fn(); window.history.replaceState({}, "", "/denki"); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); delete window.gtag; });
describe("入口から詳細への流れ", () => {
  it("備蓄の水量を計算し、選んだ条件だけをタブ内で引き継ぐ", () => {
    render(<StockpileEntry placement="area" />);
    fireEvent.change(screen.getByLabelText("備蓄を調べる家庭の人数"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("備蓄を調べる日数"), { target: { value: "3" } });
    expect(screen.getByRole("status").textContent).toContain("27L");
    expect(screen.getByRole("status").textContent).toContain("14本");
    const link = screen.getByRole("link", { name: "食品・日用品もチェックする" });
    expect(link.getAttribute("href")).toBe("/bousai/stockpile?from=area&quick=1");
    fireEvent.click(link);
    expect(takeQuickEntry("stockpile", "?from=area&quick=1")).toMatchObject({ people: 3, days: 3 });
    expect(vi.mocked(window.gtag!).mock.calls.filter(c => c[1] === "stockpile_quick_result_view")).toHaveLength(1);
    for (const call of vi.mocked(window.gtag!).mock.calls) expect(Object.keys(call[2] || {})).toEqual(expect.arrayContaining(["placement", "measurement_version", "cta_variant"]));
  });
  it("電気の人数・エリア・契約アンペアをStrictModeでも引き継ぐ", () => {
    saveQuickEntry({ tool: "denki", people: 4, area: "tokyo", code: "22210", from: "area_detail" });
    window.history.replaceState({}, "", "/denki?code=22210&from=area_detail&quick=1");
    render(<StrictMode><DenkiSimulator /></StrictMode>);
    expect((screen.getByLabelText("世帯人数") as HTMLSelectElement).value).toBe("4");
    expect((screen.getByLabelText("供給エリア") as HTMLSelectElement).value).toBe("tokyo");
    expect((screen.getByLabelText("契約アンペア") as HTMLSelectElement).value).toBe("40");
    expect(vi.mocked(window.gtag!).mock.calls.filter(c => c[1] === "denki_simulate")).toHaveLength(0);
  });
});
