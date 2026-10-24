// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { DenkiTeaser } from "@/components/area/DenkiTeaser";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); delete window.gtag; });
describe("電気代試算への入口", () => {
  it("自治体と送客元を引き継ぎ、視認とクリックを区別する", () => {
    window.gtag = vi.fn();
    let notify: (entries: { isIntersecting: boolean; intersectionRatio: number }[]) => void = () => {};
    vi.stubGlobal("IntersectionObserver", class {
      constructor(cb: typeof notify) { notify = cb; }
      observe() {}
      disconnect() {}
    });
    const { getByRole, getByText } = render(<DenkiTeaser municipalityCode="13101" municipalityName="千代田区" />);
    getByText("千代田区の電気代の目安を確認する");
    const link = getByRole("link", { name: "電気代の目安を試算する" });
    expect(link.getAttribute("href")).toBe("/denki?code=13101&from=area_detail");
    expect(window.gtag).not.toHaveBeenCalled();
    act(() => notify([{ isIntersecting: true, intersectionRatio: 0.5 }]));
    expect(window.gtag).toHaveBeenCalledWith("event", "denki_entry_view", expect.objectContaining({ municipality_code: "13101", placement: "area-overview", area: "tokyo" }));
    fireEvent.click(link);
    expect(window.gtag).toHaveBeenCalledWith("event", "denki_entry_click", expect.objectContaining({ municipality_code: "13101", cta_variant: "estimate-v1" }));
  });
  it("供給エリアが分かれる自治体は両方を説明し、不明なコードでは出さない", () => {
    const { container, rerender } = render(<DenkiTeaser municipalityCode="22210" municipalityName="富士市" />);
    expect(container.textContent).toContain("地区によって");
    expect(container.textContent).toContain("東京電力");
    expect(container.textContent).toContain("中部電力");
    rerender(<DenkiTeaser municipalityCode="99999" municipalityName="不明" />);
    expect(container.textContent).toBe("");
  });
});
