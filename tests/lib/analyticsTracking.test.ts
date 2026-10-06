// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  trackCompareReady, trackCompareView,
  trackShindanResultImpression, trackShindanResultScroll,
} from "@/lib/analytics";

afterEach(() => { delete window.gtag; });

describe("比較・診断イベントのGA4契約", () => {
  it("比較成立と視認を別イベントとして送り、直接訪問に送客元を付けない", () => {
    const gtag = vi.fn();
    window.gtag = gtag;
    trackCompareReady(2, "pref_ranking_top3");
    trackCompareView(2, null);
    expect(gtag).toHaveBeenNthCalledWith(1, "event", "compare_ready", { count: 2, tool_source: "pref_ranking_top3" });
    expect(gtag).toHaveBeenNthCalledWith(2, "event", "compare_view", { count: 2 });
  });

  it("診断結果の件数を登録済みのsnake_caseパラメータで送る", () => {
    const gtag = vi.fn();
    window.gtag = gtag;
    trackShindanResultImpression({ resultCount: 10, eligibleCount: 312, weights: "200000", regions: "kanto" });
    trackShindanResultScroll({ resultCount: 10, weights: "200000", regions: "kanto" });
    expect(gtag).toHaveBeenNthCalledWith(1, "event", "shindan_result_impression", {
      result_count: 10, eligible_count: 312, weights: "200000", regions: "kanto",
    });
    expect(gtag).toHaveBeenNthCalledWith(2, "event", "shindan_result_scroll", {
      result_count: 10, weights: "200000", regions: "kanto",
    });
  });
});
