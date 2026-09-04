// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent, act } from "@testing-library/react";
import { FurusatoLink } from "@/components/monetization/FurusatoLink";
import type { FurusatoLinkInfo } from "@/lib/monetization";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete (window as { gtag?: unknown }).gtag;
});

// アフィリエイト導線のコンプライアンス（広告明示 + rel="sponsored" + AT計測ピクセル）と、
// リンク種別（municipal / portal）に応じた文言の切り替えを守る。
// 表示可否（env・ふるなび未掲載）はサーバー側 furusatoLink の担当（lib テストで担保）。
describe("FurusatoLink", () => {
  const municipal: FurusatoLinkInfo = {
    url: "https://h.accesstrade.net/sp/cc?rk=abc&url=x",
    kind: "municipal",
    impressionPixel: "https://h.accesstrade.net/sp/rr?rk=abc",
  };

  it("municipal: 自治体名入りの文言・広告表記・rel=sponsored・計測ピクセル", () => {
    const { container, getByText } = render(
      <FurusatoLink link={municipal} targetName="札幌市" municipalityCode="01100" />,
    );
    getByText("札幌市のふるさと納税を見る");
    expect(container.textContent).toContain("広告");
    const a = container.querySelector("a");
    expect(a?.getAttribute("href")).toBe(municipal.url);
    expect(a?.getAttribute("rel")).toContain("sponsored");
    expect(a?.getAttribute("rel")).toContain("noopener");
    // AT はリファラで掲載サイトを確認するため noreferrer は付けない
    expect(a?.getAttribute("rel")).not.toContain("noreferrer");
    expect(a?.getAttribute("referrerpolicy")).toBe("no-referrer-when-downgrade");
    // AT のインプレッション計測ピクセル（sp/rr）をリンクと対で描画する
    expect(container.querySelector('img[src="https://h.accesstrade.net/sp/rr?rk=abc"]')).not.toBeNull();
  });

  it("portal: 応援文言に切り替わり、ピクセル null なら計測画像を描画しない", () => {
    const portal: FurusatoLinkInfo = { url: "https://example.com/", kind: "portal", impressionPixel: null };
    const { container, getByText } = render(
      <FurusatoLink link={portal} targetName="札幌市" municipalityCode="01100" />,
    );
    getByText("ふるさと納税で札幌市を応援する");
    expect(container.textContent).toContain("寄付先は移動先で選択できます");
    expect(container.querySelector("img[width='1']")).toBeNull();
  });

  it("targetName なし（ランキング等の共通面）: 自治体に紐付かない中立文言", () => {
    const portal: FurusatoLinkInfo = { url: "https://example.com/", kind: "portal", impressionPixel: null };
    const { getByText } = render(<FurusatoLink link={portal} placement="ranking" />);
    getByText("ふるさと納税で自治体を応援する");
  });

  it("クリックで furusato_link_click を kind / placement / 自治体情報つきで送る", () => {
    const gtag = vi.fn();
    window.gtag = gtag;
    const { container } = render(
      <FurusatoLink link={municipal} targetName="札幌市" municipalityCode="01100" />,
    );
    fireEvent.click(container.querySelector("a")!);
    expect(gtag).toHaveBeenCalledWith("event", "furusato_link_click", {
      kind: "municipal",
      placement: "area",
      municipality_code: "01100",
      municipality_name: "札幌市",
    });
  });

  it("ビューポート50%到達で furusato_link_impression を1回だけ送る", () => {
    const gtag = vi.fn();
    window.gtag = gtag;
    // jsdom には IntersectionObserver がないためスタブし、コールバックを手で発火させる
    let callback: (entries: Array<{ isIntersecting: boolean }>) => void = () => {};
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: typeof callback) {
          callback = cb;
        }
        observe = observe;
        disconnect = disconnect;
        unobserve = vi.fn();
      },
    );
    render(<FurusatoLink link={municipal} targetName="札幌市" municipalityCode="01100" />);
    expect(observe).toHaveBeenCalled();

    act(() => callback([{ isIntersecting: false }]));
    expect(gtag).not.toHaveBeenCalled();

    act(() => callback([{ isIntersecting: true }]));
    expect(gtag).toHaveBeenCalledWith("event", "furusato_link_impression", {
      kind: "municipal",
      placement: "area",
      municipality_code: "01100",
      municipality_name: "札幌市",
    });

    // 2度目の到達では送らない（1要素1回）
    act(() => callback([{ isIntersecting: true }]));
    expect(gtag).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalled();
  });

  it("IntersectionObserver がない環境（jsdom 素の状態）でも描画が壊れない", () => {
    const { container } = render(
      <FurusatoLink link={municipal} targetName="札幌市" municipalityCode="01100" />,
    );
    expect(container.querySelector("a")).not.toBeNull();
  });
});
