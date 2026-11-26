// @vitest-environment jsdom
import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RankingExplorer from "@/components/ranking/RankingExplorer";
import { track } from "@/lib/analytics";

vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/lib/adsense", () => ({ navigateDocument: vi.fn() }));
vi.mock("@/components/SiteLink", () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }));
vi.mock("@/components/compare/CompareSelectionProvider", () => ({ useCompareSelection: () => ({ candidates: [], toggle: vi.fn() }) }));
vi.mock("@/components/monetization/DisplayAd", () => ({ default: () => <aside aria-label="広告" /> }));
vi.mock("@/components/ContentFeedback", () => ({ default: () => null }));
vi.mock("@/components/ShareButton", () => ({ ShareButton: () => null }));

const observers: { callback: IntersectionObserverCallback; targets: Set<Element>; disconnected: boolean }[] = [];
const props = { rows: Array.from({ length: 14 }, (_, i) => ({ code: `40${String(i).padStart(3, "0")}`, name: `福岡の街${i + 1}`, pref: "fukuoka", value: `${100 - i}人` })), metric: "population-most", columnLabel: "人口", isList: false, initialPref: "fukuoka", metrics: [{ slug: "population-most", label: "人口" }] };
function observe(target: Element, ratio = 0.5) {
  act(() => { for (const o of observers) if (!o.disconnected && o.targets.has(target)) o.callback([{ target, isIntersecting: ratio > 0, intersectionRatio: ratio } as IntersectionObserverEntry], {} as IntersectionObserver); });
}
beforeEach(() => {
  observers.length = 0;
  window.history.replaceState(null, "", "/ranking/population-most/fukuoka");
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  window.gtag = vi.fn();
  vi.stubGlobal("IntersectionObserver", class {
    record: typeof observers[number];
    constructor(callback: IntersectionObserverCallback) { this.record = { callback, targets: new Set(), disconnected: false }; observers.push(this.record); }
    observe = (el: Element) => { this.record.targets.add(el); };
    unobserve = (el: Element) => { this.record.targets.delete(el); };
    disconnect = () => { this.record.disconnected = true; };
  });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); delete window.gtag; });
const setup = (extra: Partial<typeof props> = {}) => render(<StrictMode><RankingExplorer {...props} {...extra} /></StrictMode>);

describe("福岡の順位表の続き計測", () => {
  it("福岡の続き操作を広告より前に置き、summaryと11件目だけを観測する", () => {
    const { container } = setup();
    const grid = container.querySelector(".rk-explorer-grid")!;
    expect(grid.children[1].tagName).toBe("DETAILS");
    expect(grid.children[2].querySelector("aside")).not.toBeNull();
    const active = observers.filter(o => !o.disconnected).flatMap(o => [...o.targets]);
    expect(active.map(e => e.tagName)).toEqual(["SUMMARY", "TR"]);
    expect(active[1].textContent).toContain("福岡の街11");
    expect(track).not.toHaveBeenCalled();
  });
  it("50%未満と閉じた行を数えず、操作視認・展開・行視認を別々に一度だけ送る", async () => {
    const { container } = setup();
    const details = container.querySelector("details")!;
    const summary = details.querySelector("summary")!;
    const row = details.querySelector("tbody tr")!;
    observe(summary, .49); observe(row);
    expect(track).not.toHaveBeenCalled();
    observe(summary); observe(summary);
    expect(track).toHaveBeenCalledExactlyOnceWith("ranking_rest_control_view", { metric_key: "population-most", section: "rest", measurement_version: "ranking-rest-v1", cta_variant: "fukuoka-rest-before-ad" });
    await userEvent.click(summary);
    await waitFor(() => expect(track).toHaveBeenCalledWith("ranking_rest_open", expect.any(Object)));
    expect(vi.mocked(track).mock.calls.some(([name]) => name === "ranking_rest_view")).toBe(false);
    observe(row);
    await userEvent.click(summary); await userEvent.click(summary); observe(row);
    expect(vi.mocked(track).mock.calls.map(([name]) => name)).toEqual(["ranking_rest_control_view", "ranking_rest_open", "ranking_rest_view"]);
  });
  it("キーボード起因のdetail=0のclickでも実際の展開を記録する", async () => {
    const { container } = setup();
    const summary = container.querySelector("summary")!;
    summary.focus();
    // jsdom/user-eventはsummaryのEnter既定動作を実装していないため、
    // ブラウザーがキーボード操作から生成するclickで確認する。
    fireEvent.click(summary, { detail: 0, button: 0 });
    await waitFor(() => expect(track).toHaveBeenCalledWith("ranking_rest_open", expect.any(Object)));
  });
  it("プログラムによるopen変更は操作に数えないが、実際の行の視認は数える", () => {
    const { container } = setup(); const details = container.querySelector("details")!;
    act(() => { details.open = true; fireEvent(details, new Event("toggle")); });
    expect(track).not.toHaveBeenCalled();
    observe(details.querySelector("tbody tr")!);
    expect(track).toHaveBeenCalledExactlyOnceWith("ranking_rest_view", expect.any(Object));
  });
  it("非表示タブでは送らず、復帰時に観測し直す。gtag未準備でも送信済みにしない", () => {
    const { container } = setup(); const summary = container.querySelector("summary")!;
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    observe(summary); expect(track).not.toHaveBeenCalled();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    delete window.gtag;
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    observe(summary); expect(track).not.toHaveBeenCalled();
    window.gtag = vi.fn(); observe(summary);
    expect(track).toHaveBeenCalledTimes(1);
  });
  it("検索入力の間は送らず、空に戻った子要素の再マウントでも重複しない", () => {
    const { container } = setup();
    observe(container.querySelector("summary")!);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "街" } });
    observe(container.querySelector("summary")!);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
    observe(container.querySelector("summary")!);
    expect(track).toHaveBeenCalledTimes(1);
  });
  it.each([{ metric: "stations" }, { initialPref: "hyogo" }, { initialPref: undefined }])("対象外では計測しない %j", extra => {
    setup(extra); expect(observers.filter(o => !o.disconnected)).toHaveLength(0);
  });
});
