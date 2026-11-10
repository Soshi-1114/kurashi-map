// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import DisplayAd from "@/components/monetization/DisplayAd";
import { loadAdsense, requestAdsenseSlot } from "@/lib/adsenseLoader";

const mode = vi.hoisted(() => ({ live: false }));
vi.mock("@/lib/adsensePolicy.mjs", async original => ({ ...await original<object>(), canServeAds: () => mode.live }));
vi.mock("@/lib/adsenseLoader", () => ({ loadAdsense: vi.fn(async () => {}), requestAdsenseSlot: vi.fn() }));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_ADSENSE_ENABLED", "true");
  vi.stubEnv("NEXT_PUBLIC_ADSENSE_RANKING_SLOT_ID", "1234567890");
  vi.stubEnv("NEXT_PUBLIC_ADSENSE_AREA_SLOT_ID", "0987654321");
  window.history.replaceState(null, "", "/ranking/population-most");
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ width: 390 } as DOMRect);
  mode.live = false;
  vi.mocked(loadAdsense).mockResolvedValue();
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("本文内広告", () => {
  it("無効・広告枠ID不足なら枠もスクリプトも出さない", () => {
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_ENABLED", "false");
    const { container, rerender } = render(<DisplayAd placement="ranking" />);
    expect(container.innerHTML).toBe("");
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_RANKING_SLOT_ID", "");
    rerender(<DisplayAd placement="ranking" />);
    expect(container.innerHTML).toBe("");
    expect(loadAdsense).not.toHaveBeenCalled();
  });
  it("プレビューは高さを確保したダミー枠だけで外部通信しない", () => {
    const { container } = render(<DisplayAd placement="ranking" />);
    expect(container.querySelector("aside")?.dataset.mode).toBe("preview");
    expect(container.querySelector("ins")?.style.height).toBe("250px");
    expect(loadAdsense).not.toHaveBeenCalled();
  });
  it("本番でもStrictMode・再レンダーで枠を二重初期化しない", async () => {
    mode.live = true;
    const { rerender } = render(<StrictMode><DisplayAd placement="ranking" /></StrictMode>);
    await waitFor(() => expect(requestAdsenseSlot).toHaveBeenCalledTimes(1));
    rerender(<StrictMode><DisplayAd placement="ranking" /></StrictMode>);
    expect(requestAdsenseSlot).toHaveBeenCalledTimes(1);
  });
  it("操作ページや異なるページ群ではスクリプトを読まない", () => {
    mode.live = true;
    window.history.replaceState(null, "", "/compare");
    const { rerender } = render(<DisplayAd placement="ranking" />);
    window.history.replaceState(null, "", "/area/tokyo");
    rerender(<DisplayAd placement="area" />);
    expect(loadAdsense).toHaveBeenCalledTimes(1);
  });
  it("読み込み失敗時も再試行せず、予約した枠を維持する", async () => {
    mode.live = true;
    vi.mocked(loadAdsense).mockRejectedValue(new Error("blocked"));
    const { container } = render(<DisplayAd placement="ranking" />);
    await act(async () => {});
    expect(container.querySelector("ins")).not.toBeNull();
    expect(requestAdsenseSlot).not.toHaveBeenCalled();
  });
  it("幅0の間はリクエストせず、幅の確定後に一度だけ初期化する", async () => {
    mode.live = true;
    let notify: () => void = () => {};
    const disconnect = vi.fn();
    vi.stubGlobal("ResizeObserver", class { constructor(callback: () => void) { notify = callback; } observe() {} disconnect = disconnect; });
    vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockReturnValue({ width: 0 } as DOMRect);
    render(<DisplayAd placement="ranking" />);
    await act(async () => {});
    expect(requestAdsenseSlot).not.toHaveBeenCalled();
    vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockReturnValue({ width: 390 } as DOMRect);
    act(() => { notify(); notify(); });
    expect(requestAdsenseSlot).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalled();
  });
});
