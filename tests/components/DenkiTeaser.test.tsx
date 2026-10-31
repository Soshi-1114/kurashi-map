// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DenkiTeaser } from "@/components/area/DenkiTeaser";
import { DENKI_PLANS } from "@/lib/denkiPlans";
import { compareOffers, HOUSEHOLD_KWH, defaultAmpere } from "@/lib/denkiSim";
import { takeQuickEntry } from "@/lib/quickEntry";
beforeEach(() => { sessionStorage.clear(); window.gtag = vi.fn(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); delete window.gtag; });
describe("電気代の試算入口", () => {
  it("既存の試算式と一致し、入力をURLに載せず詳細へ引き継ぐ", () => {
    render(<DenkiTeaser municipalityCode="13101" municipalityName="千代田区" />);
    expect(screen.getByRole("status").textContent).toContain("人数を選ぶと");
    fireEvent.change(screen.getByLabelText("電気代を調べる世帯人数"), { target: { value: "4" } });
    const expected = compareOffers(DENKI_PLANS, "tokyo", HOUSEHOLD_KWH[4], defaultAmpere(4)).find(p => p.kind === "baseline")!.monthlyYen;
    expect(screen.getByRole("status").textContent).toContain(expected.toLocaleString());
    const link = screen.getByRole("link", { name: "使用量を変えて詳しく試算する" });
    expect(link.getAttribute("href")).toBe("/denki?code=13101&from=area_detail&quick=1");
    fireEvent.click(link);
    expect(takeQuickEntry("denki", "?code=13101&from=area_detail&quick=1")).toMatchObject({ people: 4, area: "tokyo" });
    expect(vi.mocked(window.gtag!).mock.calls.filter(c => c[1] === "denki_quick_result_view")).toHaveLength(1);
    for (const c of vi.mocked(window.gtag!).mock.calls) expect(c[2]).not.toHaveProperty("people");
  });
  it("50%の視認を満たすまで入口視認を送らない", () => {
    let notify: (entries: { isIntersecting: boolean; intersectionRatio: number }[]) => void = () => {};
    vi.stubGlobal("IntersectionObserver", class { constructor(cb: typeof notify) { notify = cb; } observe() {} disconnect() {} });
    render(<DenkiTeaser municipalityCode="13101" municipalityName="千代田区" />);
    act(() => notify([{ isIntersecting: true, intersectionRatio: 0.2 }]));
    expect(window.gtag).not.toHaveBeenCalled();
    act(() => notify([{ isIntersecting: true, intersectionRatio: 0.5 }]));
    expect(window.gtag).toHaveBeenCalledWith("event", "denki_entry_view", expect.objectContaining({ placement: "area-overview", cta_variant: "inline-v1" }));
  });
  it("境界エリアを選び直せて、不明な自治体は表示しない", () => {
    const { container, rerender } = render(<DenkiTeaser municipalityCode="22210" municipalityName="富士市" />);
    expect(container.textContent).toContain("地区によって");
    fireEvent.change(screen.getByLabelText("電気代を調べる世帯人数"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("供給エリア"), { target: { value: "chubu" } });
    fireEvent.click(screen.getByRole("link", { name: "使用量を変えて詳しく試算する" }));
    expect(takeQuickEntry("denki", "?code=22210&from=area_detail&quick=1")).toMatchObject({ people: 2, area: "chubu" });
    rerender(<DenkiTeaser municipalityCode="99999" municipalityName="不明" />);
    expect(container.textContent).toBe("");
  });
});
