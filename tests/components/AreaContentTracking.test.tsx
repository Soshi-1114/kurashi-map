// @vitest-environment jsdom
import { StrictMode } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AreaContentTracking from "@/components/area/AreaContentTracking";

let notify: IntersectionObserverCallback;
const observe = vi.fn();
const unobserve = vi.fn();
const disconnect = vi.fn();
function reach(id: string, ratio = 0.5) {
  const target = document.querySelector(`#${id} h1, #${id} h2`)!;
  act(() => notify([{ target, isIntersecting: ratio > 0, intersectionRatio: ratio } as IntersectionObserverEntry], {} as IntersectionObserver));
}
beforeEach(() => {
  document.body.innerHTML = '<header id="overview"><h1>概要</h1></header><section id="data"><h2>詳細データ</h2><p>本文</p></section><aside data-ad-placement="area"><ins class="adsbygoogle"></ins></aside>';
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  window.gtag = vi.fn();
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: IntersectionObserverCallback) { notify = callback; }
    observe = observe; unobserve = unobserve; disconnect = disconnect;
  });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); delete window.gtag; });

describe("自治体本文の到達計測", () => {
  it("長い本文全体や広告要素ではなく、存在する見出しだけを観測する", () => {
    render(<AreaContentTracking municipalityCode="13101" />);
    expect(observe.mock.calls.map(([el]) => el.tagName)).toEqual(["H1", "H2"]);
    expect(window.gtag).not.toHaveBeenCalled();
  });
  it("50%未満で送らず、到達したセクションだけを一度送る", () => {
    const { rerender } = render(<StrictMode><AreaContentTracking municipalityCode="13101" /></StrictMode>);
    reach("data", 0.49);
    expect(window.gtag).not.toHaveBeenCalled();
    reach("data"); reach("data", 1);
    rerender(<StrictMode><AreaContentTracking municipalityCode="13101" /></StrictMode>);
    expect(window.gtag).toHaveBeenCalledExactlyOnceWith("event", "area_section_view", {
      municipality_code: "13101", section: "data", measurement_version: "2026-11-20",
    });
    // 詳細データへ直接ジャンプしても概要への到達を推測しない。
  });
  it("非表示タブでは送らず、表示に戻ったら未送信の見出しを再観測する", () => {
    render(<AreaContentTracking municipalityCode="13101" />);
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    reach("data");
    expect(window.gtag).not.toHaveBeenCalled();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(observe).toHaveBeenCalledTimes(4);
    reach("data");
    expect(window.gtag).toHaveBeenCalledTimes(1);
  });
  it("別自治体へのクライアント遷移は別の到達として記録する", () => {
    const { rerender } = render(<AreaContentTracking municipalityCode="13101" />);
    reach("data");
    rerender(<AreaContentTracking municipalityCode="13102" />);
    reach("data");
    expect(window.gtag).toHaveBeenCalledTimes(2);
    expect(window.gtag).toHaveBeenLastCalledWith("event", "area_section_view", expect.objectContaining({ municipality_code: "13102" }));
  });
  it("gtagがなければ送信済みにせず、次の実際の到達で送る", () => {
    delete window.gtag;
    render(<AreaContentTracking municipalityCode="13101" />);
    reach("data");
    window.gtag = vi.fn();
    reach("data");
    expect(window.gtag).toHaveBeenCalledTimes(1);
  });
  it("非対応ブラウザは無計測、アンマウント時は観測を停止する", () => {
    const { unmount } = render(<AreaContentTracking municipalityCode="13101" />);
    unmount();
    expect(disconnect).toHaveBeenCalled();
    vi.stubGlobal("IntersectionObserver", undefined);
    expect(() => render(<AreaContentTracking municipalityCode="13101" />)).not.toThrow();
  });
});
