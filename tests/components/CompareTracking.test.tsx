// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CompareClient from "@/components/compare/CompareClient";
import { muni, muniSummary } from "../_fixtures";
import type { NationalAverages } from "@/lib/compareMetrics";

const mocked = vi.hoisted(() => ({
  params: new URLSearchParams("codes=11203,11201&from=pref_ranking_top3&experiment_id=compare-link-2026-09&variant=baseline&origin_path=%2Franking%2Fpopulation-growth%2Fosaka"),
  ready: vi.fn(),
  view: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => mocked.params,
}));
vi.mock("@/lib/analytics", () => ({
  trackToolEntry: vi.fn(),
  trackCompareReady: mocked.ready,
  trackCompareView: mocked.view,
}));

const averages: NationalAverages = {
  rent: null, landPrice: null, populationChangeRate: null, vacancyRate: null,
  density: null, foreignRatio: null, agingRate: null, fiscalIndex: null,
};
const summaries = [
  muniSummary({ code: "11203", name: "川口市" }),
  muniSummary({ code: "11201", name: "川越市" }),
];
const data = new Map([
  ["11203", muni({ code: "11203", name: "川口市" })],
  ["11201", muni({ code: "11201", name: "川越市" })],
]);
const observers: Array<{ callback: IntersectionObserverCallback; nodes: Element[] }> = [];

beforeEach(() => {
  mocked.params = new URLSearchParams("codes=11203,11201&from=pref_ranking_top3&experiment_id=compare-link-2026-09&variant=baseline&origin_path=%2Franking%2Fpopulation-growth%2Fosaka");
  mocked.ready.mockClear();
  mocked.view.mockClear();
  observers.length = 0;
  vi.stubGlobal("IntersectionObserver", class {
    callback: IntersectionObserverCallback;
    nodes: Element[] = [];
    constructor(callback: IntersectionObserverCallback) {
      this.callback = callback;
      observers.push(this);
    }
    observe(node: Element) { this.nodes.push(node); }
    disconnect() {}
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function setup() {
  return render(<CompareClient munis={summaries} nationalAverages={averages} prefAverages={{}} />);
}

describe("比較成果の計測", () => {
  it("2件のデータ取得後だけ成立し、表の視認と再レンダーで重複しない", async () => {
    let resolveSecond!: (value: ReturnType<typeof muni>) => void;
    const second = new Promise<ReturnType<typeof muni>>((resolve) => { resolveSecond = resolve; });
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve({
      ok: true,
      json: () => url.endsWith("11203") ? Promise.resolve(data.get("11203")) : second,
    })));
    const result = setup();
    await waitFor(() => expect(result.container.querySelectorAll(".cmp-loading").length).toBeGreaterThan(0));
    expect(mocked.ready).not.toHaveBeenCalled();
    expect(mocked.view).not.toHaveBeenCalled();

    await act(async () => resolveSecond(data.get("11201")!));
    await waitFor(() => expect(mocked.ready).toHaveBeenCalledWith(2, "pref_ranking_top3", {
      experimentId: "compare-link-2026-09", variant: "baseline", originPath: "/ranking/population-growth/osaka",
    }));
    expect(mocked.ready).toHaveBeenCalledTimes(1);
    expect(mocked.view).not.toHaveBeenCalled();
    const observer = observers.at(-1)!;
    expect(observer.nodes).toContain(result.container.querySelector(".cmp-table thead"));
    expect(observer.nodes).toContain(result.container.querySelector(".cmp-mgroup-title"));
    act(() => observer.callback([{ isIntersecting: true } as IntersectionObserverEntry], observer as unknown as IntersectionObserver));
    expect(mocked.view).toHaveBeenCalledWith(2, "pref_ranking_top3", {
      experimentId: "compare-link-2026-09", variant: "baseline", originPath: "/ranking/population-growth/osaka",
    });
    result.rerender(<CompareClient munis={summaries} nationalAverages={averages} prefAverages={{}} />);
    expect(mocked.ready).toHaveBeenCalledTimes(1);
    expect(mocked.view).toHaveBeenCalledTimes(1);
  });

  it("1件・取得エラー・無効コードでは成立を送らない", async () => {
    mocked.params = new URLSearchParams("codes=11203,99999&from=ranking_row");
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(data.get("11203")) })));
    const one = setup();
    await waitFor(() => expect(one.container.querySelectorAll(".cmp-loading").length).toBe(0));
    expect(mocked.ready).not.toHaveBeenCalled();
    one.unmount();

    mocked.params = new URLSearchParams("codes=11203,11201&from=ranking_row");
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(
      url.endsWith("11201")
        ? { ok: false, status: 500 }
        : { ok: true, json: () => Promise.resolve(data.get("11203")) },
    )));
    const failed = setup();
    await waitFor(() => expect(failed.container.textContent).toContain("取得エラー"));
    expect(mocked.ready).not.toHaveBeenCalled();
    expect(mocked.view).not.toHaveBeenCalled();
  });
});
