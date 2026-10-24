// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import DenkiOfferLink from "@/components/denki/DenkiOfferLink";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); delete window.gtag; });
const props = { company: "東急でんき", planName: "従量電灯B", offerId: "tokyu-b", area: "tokyo", position: 1 };
const affiliate = { url: "https://h.accesstrade.net/sp/cc?rk=example", isAffiliate: true, impressionPixel: "https://h.accesstrade.net/sp/rr?rk=example" };
describe("電気プランの外部導線", () => {
  it("提携リンクと画像を保持し、リファラ・広告表記・識別できるリンク名を設定する", () => {
    window.gtag = vi.fn();
    const { getByRole, container } = render(<DenkiOfferLink {...props} link={affiliate} />);
    const link = getByRole("link", { name: "東急でんき 従量電灯Bの料金・条件を確認する" });
    expect(link.getAttribute("href")).toBe(affiliate.url);
    expect(link.getAttribute("rel")).toBe("sponsored nofollow noopener");
    expect(link.getAttribute("referrerpolicy")).toBe("no-referrer-when-downgrade");
    expect(container.textContent).toContain("広告・東急でんき");
    expect(container.querySelector("img")?.getAttribute("src")).toBe(affiliate.impressionPixel);
    fireEvent.click(link);
    expect(window.gtag).toHaveBeenCalledWith("event", "denki_offer_click", {
      offer_id: "tokyu-b", area: "tokyo", is_affiliate: true, position: 1,
      measurement_version: "2026-10-24", cta_variant: "conditions-v1",
    });
  });
  it("未提携の公式リンクを広告として扱わない", () => {
    const { container, getByRole } = render(<DenkiOfferLink {...props} link={{ url: "https://example.com/official", isAffiliate: false, impressionPixel: null }} />);
    expect(getByRole("link").getAttribute("rel")).toBe("noopener noreferrer");
    expect(container.textContent).not.toContain("広告・");
    expect(container.querySelector("img")).toBeNull();
  });
  it("画面に50%以上入るまでプラン視認を送らず、再レンダーで重複させない", () => {
    window.gtag = vi.fn();
    let notify: (entries: { isIntersecting: boolean; intersectionRatio: number }[]) => void = () => {};
    vi.stubGlobal("IntersectionObserver", class {
      constructor(cb: typeof notify) { notify = cb; }
      observe() {}
      disconnect() {}
    });
    const { rerender } = render(<DenkiOfferLink {...props} link={affiliate} />);
    act(() => notify([{ isIntersecting: true, intersectionRatio: 0.1 }]));
    expect(window.gtag).not.toHaveBeenCalled();
    act(() => notify([{ isIntersecting: true, intersectionRatio: 0.5 }]));
    rerender(<DenkiOfferLink {...props} link={affiliate} />);
    act(() => notify([{ isIntersecting: true, intersectionRatio: 1 }]));
    expect(window.gtag).toHaveBeenCalledTimes(1);
    expect(window.gtag).toHaveBeenLastCalledWith("event", "denki_offer_view", {
      offer_id: "tokyu-b", area: "tokyo", is_affiliate: true, position: 1,
      measurement_version: "2026-10-24", cta_variant: "conditions-v1",
    });
  });
});
