// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RankingExplorer from "@/components/ranking/RankingExplorer";

vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/lib/adsense", () => ({ navigateDocument: vi.fn() }));
vi.mock("@/components/SiteLink", () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }));
vi.mock("@/components/compare/CompareSelectionProvider", () => ({ useCompareSelection: () => ({ candidates: [], toggle: vi.fn() }) }));
vi.mock("@/components/monetization/DisplayAd", () => ({ default: () => <aside aria-label="広告" /> }));
vi.mock("@/components/ContentFeedback", () => ({ default: () => null }));
vi.mock("@/components/ShareButton", () => ({ ShareButton: () => null }));
afterEach(cleanup);
function setup(metric = "population-most", initialPref: string | null = "fukuoka", count = 14) {
  return render(<RankingExplorer metric={metric} initialPref={initialPref ?? undefined} columnLabel="人口" isList={false} metrics={[{ slug: metric, label: "人口" }]} rows={Array.from({ length: count }, (_, i) => ({ code: `40${String(i).padStart(3, "0")}`, name: `街${i + 1}`, pref: initialPref ?? "fukuoka", value: `${100 - i}人` }))} />);
}
describe("福岡1URLの配置変更", () => {
  it("展開・閉じ直し・検索でも広告DOMを作り直さず、全順位を一度ずつ表示する", () => {
    const { container } = setup();
    const ad = screen.getByLabelText("広告");
    const details = container.querySelector("details")!;
    expect(details.compareDocumentPosition(ad) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelectorAll("tbody tr")).toHaveLength(14);
    fireEvent.click(details.querySelector("summary")!);
    expect(details.open).toBe(true);
    expect(screen.getByLabelText("広告")).toBe(ad);
    fireEvent.click(details.querySelector("summary")!);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "街14" } });
    expect(container.querySelectorAll("tbody tr")).toHaveLength(1);
    expect(container.querySelector("tbody tr")?.textContent).toContain("14街14");
    expect(screen.getByLabelText("広告")).toBe(ad);
    expect(container.querySelector("details")).toBeNull();
  });
  it.each([["stations", "fukuoka"], ["population-most", "hyogo"], ["population-most", "hokkaido"], ["population-most", "all"]])("%s/%sの既存順序を維持する", (metric, pref) => {
    const { container } = setup(metric, pref === "all" ? null : pref);
    const grid = container.querySelector(".rk-explorer-grid")!;
    expect(grid.children[1].querySelector("aside")).not.toBeNull();
    expect(grid.children[2].tagName).toBe("DETAILS");
  });
  it("10件以下と検索結果0件では存在しない続きを作らない", () => {
    const { container } = setup("population-most", "fukuoka", 10);
    expect(container.querySelector("details")).toBeNull();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "存在しない街" } });
    expect(container.querySelector("details")).toBeNull();
    expect(screen.getAllByLabelText("広告")).toHaveLength(1);
  });
});
