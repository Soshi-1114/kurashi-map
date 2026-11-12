// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ShindanClient from "@/components/shindan/ShindanClient";
import TrackedCompareLink from "@/components/ranking/TrackedCompareLink";
import { compareHref, parseCompareAttribution, rankingCompareAttribution } from "@/lib/siteNav";
import { compareAttributionParams, trackCompareView } from "@/lib/analytics";

beforeEach(() => { window.gtag = vi.fn(); window.history.replaceState({}, "", "/shindan"); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); delete window.gtag; });

describe("比較へ到達する導線", () => {
  it("ボタンが半分見えた時だけ視認を送り、成果まで同じ登録済みvariantを使う", () => {
    let notify!: IntersectionObserverCallback;
    vi.stubGlobal("IntersectionObserver", class { constructor(cb: IntersectionObserverCallback) { notify = cb; } observe() {} disconnect() {} });
    const attribution = rankingCompareAttribution("population-most", "hokkaido")!;
    render(<TrackedCompareLink href={compareHref(["01100", "01204", "01202"], "pref_ranking_top3", attribution)} count={3} attribution={attribution} />);
    act(() => notify([{ isIntersecting: true, intersectionRatio: 0.2 } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(window.gtag).not.toHaveBeenCalled();
    act(() => notify([{ isIntersecting: true, intersectionRatio: 0.5 } as IntersectionObserverEntry], {} as IntersectionObserver));
    act(() => notify([{ isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(window.gtag).toHaveBeenCalledTimes(1);
    expect(window.gtag).toHaveBeenCalledWith("event", "compare_cta_view", expect.objectContaining({ cta_variant: "population-compare-2026-11:hokkaido:treatment" }));
    trackCompareView(3, "pref_ranking_top3", attribution);
    expect(window.gtag).toHaveBeenLastCalledWith("event", "compare_view", expect.objectContaining(compareAttributionParams(attribution)));
  });

  it.each([2, 4])("診断結果%d件から最大3件を選択済みで渡し、詳細へ直接進める", (size) => {
    const codes = ["11203", "11201", "11202", "11204"].slice(0, size);
    const entries = codes.map((code, i) => ({ code, name: `候補${i}`, s: [5 - i, 5, 5, 5, 5, 5] }));
    const label = `上位${Math.min(size, 3)}件を比較する`;
    render(<ShindanClient entries={entries} />);
    expect(screen.queryByRole("link", { name: "上位3件を比較する" })).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "やや重視" })[0]);
    const href = screen.getByRole("link", { name: label }).getAttribute("href")!;
    const params = new URLSearchParams(href.split("?")[1]);
    expect(params.get("codes")).toBe(codes.slice(0, 3).join(","));
    expect(params.get("from")).toBe("shindan_result");
    expect(parseCompareAttribution(params)?.originPath).toBe("/shindan");
    expect(screen.getByRole("link", { name: "候補0の詳細を見る" })).toHaveAttribute("href", "/area/saitama/11203");
    expect(screen.getByRole("button", { name: "この診断条件を共有" })).toBeInTheDocument();
  });

  it("条件URLの復元で比較先を用意しても、手動の診断やクリックを水増ししない", () => {
    window.history.replaceState({}, "", "/shindan?w=200000");
    render(<ShindanClient entries={["11203", "11201"].map(code => ({ code, name: code, s: [5, 5, 5, 5, 5, 5] }))} />);
    expect(screen.getByRole("link", { name: "上位2件を比較する" })).toBeInTheDocument();
    const names = vi.mocked(window.gtag!).mock.calls.map(call => call[1]);
    expect(names).not.toContain("shindan_run");
    expect(names).not.toContain("shindan_compare_top_click");
  });

  it("診断結果が1件なら成立しない比較へ誘導しない", () => {
    render(<ShindanClient entries={[{ code: "11203", name: "川口市", s: [5, 5, 5, 5, 5, 5] }]} />);
    fireEvent.click(screen.getAllByRole("button", { name: "やや重視" })[0]);
    expect(screen.queryByRole("link", { name: /上位.*件を比較/ })).toBeNull();
    expect(screen.getByRole("link", { name: "川口市の詳細を見る" })).toBeInTheDocument();
  });
});
