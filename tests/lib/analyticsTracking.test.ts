// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ANALYTICS_MEASUREMENT_VERSION,
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
    expect(gtag).toHaveBeenNthCalledWith(1, "event", "compare_ready", {
      count: 2, measurement_version: ANALYTICS_MEASUREMENT_VERSION, tool_source: "pref_ranking_top3",
    });
    expect(gtag).toHaveBeenNthCalledWith(2, "event", "compare_view", {
      count: 2, measurement_version: ANALYTICS_MEASUREMENT_VERSION,
    });
  });

  it("診断結果の件数を登録済みのsnake_caseパラメータで送る", () => {
    const gtag = vi.fn();
    window.gtag = gtag;
    trackShindanResultImpression({ resultCount: 10, eligibleCount: 312, weights: "200000", regions: "kanto" });
    trackShindanResultScroll({ resultCount: 10, weights: "200000", regions: "kanto" });
    expect(gtag).toHaveBeenNthCalledWith(1, "event", "shindan_result_impression", {
      measurement_version: ANALYTICS_MEASUREMENT_VERSION,
      result_count: 10, eligible_count: 312, weights: "200000", regions: "kanto",
    });
    expect(gtag).toHaveBeenNthCalledWith(2, "event", "shindan_result_scroll", {
      measurement_version: ANALYTICS_MEASUREMENT_VERSION,
      result_count: 10, weights: "200000", regions: "kanto",
    });
  });
});
