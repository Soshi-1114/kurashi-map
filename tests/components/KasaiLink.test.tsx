// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent, act } from "@testing-library/react";
import { KasaiLink } from "@/components/monetization/KasaiLink";
import type { KasaiLinkInfo } from "@/lib/monetization";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete (window as { gtag?: unknown }).gtag;
});

// 火災保険導線のコンプライアンス（広告明示 + rel="sponsored" + AT計測ピクセル）と
// GA4計測（placement/自治体コード付き）を守る。表示可否（env）はサーバー側
// kasaiHokenLink の担当（lib テストで担保）。
describe("KasaiLink", () => {
  const link: KasaiLinkInfo = {
    url: "https://h.accesstrade.net/sp/cc?rk=abc&url=x",
    impressionPixel: "https://h.accesstrade.net/sp/rr?rk=abc",
  };

  it("広告表記・rel=sponsored・計測ピクセル・中立文言（規制語なし）", () => {
    const { container } = render(<KasaiLink link={link} municipalityCode="11203" />);
    expect(container.textContent).toContain("広告");
    // 「お得」「還元」等の規制語を使わない
    expect(container.textContent).not.toMatch(/お得|還元|安くなる|セール/);
    const a = container.querySelector("a");
    expect(a?.getAttribute("href")).toBe(link.url);
    expect(a?.getAttribute("rel")).toContain("sponsored");
    expect(a?.getAttribute("rel")).toContain("noopener");
    // AT はリファラで掲載サイトを確認するため noreferrer は付けない
    expect(a?.getAttribute("rel")).not.toContain("noreferrer");
    expect(container.querySelector('img[src="https://h.accesstrade.net/sp/rr?rk=abc"]')).not.toBeNull();
  });

  it("クリックで kasai_link_click を placement / 自治体コードつきで送る", () => {
    const gtag = vi.fn();
    window.gtag = gtag;
    const { container } = render(<KasaiLink link={link} municipalityCode="11203" placement="area" />);
    fireEvent.click(container.querySelector("a")!);
    expect(gtag).toHaveBeenCalledWith("event", "kasai_link_click", {
      measurement_version: "2026-10-24", cta_variant: "context-v1",
      placement: "area",
      municipality_code: "11203",
    });
  });

  it("自治体に紐付かない面（hazard-map）では municipality_code を送らない", () => {
    const gtag = vi.fn();
    window.gtag = gtag;
    const { container } = render(<KasaiLink link={link} placement="hazard-map" />);
    fireEvent.click(container.querySelector("a")!);
    expect(gtag).toHaveBeenCalledWith("event", "kasai_link_click", { placement: "hazard-map", measurement_version: "2026-10-24", cta_variant: "context-v1" });
  });

  it("掲載と50%視認を分離し、自治体切り替え時は新しく計測する", () => {
    const gtag = vi.fn();
    window.gtag = gtag;
    let notify: (entries: { isIntersecting: boolean; intersectionRatio: number }[]) => void = () => {};
    vi.stubGlobal("IntersectionObserver", class {
      constructor(callback: typeof notify) { notify = callback; }
      observe() {}
      disconnect() {}
    });
    const { rerender } = render(<KasaiLink link={link} municipalityCode="11203" />);
    expect(gtag.mock.calls.map(call => call[1])).toEqual(["kasai_link_render"]);
    act(() => notify([{ isIntersecting: true, intersectionRatio: 0.1 }]));
    expect(gtag).toHaveBeenCalledTimes(1);
    act(() => notify([{ isIntersecting: true, intersectionRatio: 0.5 }]));
    act(() => notify([{ isIntersecting: true, intersectionRatio: 1 }]));
    expect(gtag.mock.calls.map(call => call[1])).toEqual(["kasai_link_render", "kasai_link_impression"]);
    rerender(<KasaiLink link={link} municipalityCode="11203" />);
    expect(gtag).toHaveBeenCalledTimes(2);
    rerender(<KasaiLink link={link} municipalityCode="13101" />);
    act(() => notify([{ isIntersecting: true, intersectionRatio: 0.5 }]));
    expect(gtag).toHaveBeenLastCalledWith("event", "kasai_link_impression", {
      measurement_version: "2026-10-24", cta_variant: "context-v1", placement: "area", municipality_code: "13101",
    });
    expect(gtag).toHaveBeenCalledTimes(4);
  });

  it("検討中の人への案内と遷移先を明示し、A8のリンク・ピクセルを加工しない", () => {
    const a8 = { url: "https://px.a8.net/svt/ejp?a8mat=example", impressionPixel: "https://www14.a8.net/0.gif?a8mat=example" };
    const { container, getByRole, getByText } = render(<KasaiLink link={a8} />);
    expect(getByText("持ち家の火災保険を新しく検討する方へ")).toBeTruthy();
    expect(getByRole("link", { name: "無料で見積もり・診断を依頼" }).getAttribute("href")).toBe(a8.url);
    expect(container.textContent).toContain("補償内容や保険料");
    expect(container.textContent).toContain("広告・外部サイト「保険スクエアbang！」");
    expect(container.querySelector("img")?.getAttribute("src")).toBe(a8.impressionPixel);
    expect(container.textContent).not.toMatch(/必ず|最安|即日|今すぐ/);
  });

  it("ピクセル null なら計測画像を描画しない", () => {
    const { container } = render(<KasaiLink link={{ url: "https://px.a8.net/x", impressionPixel: null }} />);
    expect(container.querySelector("img[width='1']")).toBeNull();
  });
});
