// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import WebVitals from "@/components/WebVitals";
const { hook } = vi.hoisted(() => ({ hook: vi.fn() }));
vi.mock("next/web-vitals", () => ({ useReportWebVitals: hook }));
afterEach(() => { cleanup(); vi.clearAllMocks(); delete window.gtag; });
describe("Web Vitals送信", () => {
  it("再レンダーでもコールバック参照を保ち、既存測定の再通知を防ぐ", () => {
    const { rerender } = render(<WebVitals />);
    const callback = hook.mock.calls[0][0];
    rerender(<WebVitals />);
    expect(hook.mock.calls[1][0]).toBe(callback);
  });
  it("CLSの1000倍・ms値の四捨五入を維持し、計測版を付ける", () => {
    window.gtag = vi.fn();
    render(<WebVitals />);
    const callback = hook.mock.calls[0][0];
    callback({ name: "CLS", value: 0.12, id: "cls-1", rating: "needs-improvement" });
    callback({ name: "LCP", value: 1234.5, id: "lcp-1", rating: "good" });
    expect(window.gtag).toHaveBeenNthCalledWith(1, "event", "web_vitals", expect.objectContaining({ value: 120, measurement_version: "2026-11-20" }));
    expect(window.gtag).toHaveBeenNthCalledWith(2, "event", "web_vitals", expect.objectContaining({ value: 1235 }));
  });
});
