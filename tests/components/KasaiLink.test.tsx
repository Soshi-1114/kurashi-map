// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
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
      placement: "area",
      municipality_code: "11203",
    });
  });

  it("自治体に紐付かない面（hazard-map）では municipality_code を送らない", () => {
    const gtag = vi.fn();
    window.gtag = gtag;
    const { container } = render(<KasaiLink link={link} placement="hazard-map" />);
    fireEvent.click(container.querySelector("a")!);
    expect(gtag).toHaveBeenCalledWith("event", "kasai_link_click", { placement: "hazard-map" });
  });

  it("ピクセル null なら計測画像を描画しない", () => {
    const { container } = render(<KasaiLink link={{ url: "https://px.a8.net/x", impressionPixel: null }} />);
    expect(container.querySelector("img[width='1']")).toBeNull();
  });
});
