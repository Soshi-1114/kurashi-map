// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import RankingExplorer from "@/components/ranking/RankingExplorer";
import type { RankingRow } from "@/lib/rankingScope";

const mocked = vi.hoisted(() => ({ navigate: vi.fn(), toggle: vi.fn() }));
vi.mock("@/lib/adsense", () => ({ navigateDocument: mocked.navigate }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/components/SiteLink", () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }));
vi.mock("@/components/compare/CompareSelectionProvider", () => ({ useCompareSelection: () => ({ candidates: [], toggle: mocked.toggle }) }));
vi.mock("@/components/monetization/DisplayAd", () => ({ default: () => <aside aria-label="広告" className="display-ad" /> }));
vi.mock("@/components/ContentFeedback", () => ({ default: ({ page }: { page: string }) => <div data-testid="feedback" data-page={page} /> }));
vi.mock("@/components/ShareButton", () => ({ ShareButton: ({ path }: { path: string }) => <button data-testid="share" data-path={path}>共有</button> }));
const metrics = [{ slug: "population-most", label: "人口が多い" }, { slug: "stations", label: "駅が多い" }];
const rows: RankingRow[] = Array.from({ length: 120 }, (_, i) => ({ code: `13${String(i).padStart(3, "0")}`, name: `東京の街${i + 1}`, pref: "tokyo", value: `${120 - i}人` }));
beforeEach(() => { window.history.replaceState(null, "", "/ranking/population-most"); vi.clearAllMocks(); });
afterEach(cleanup);
const setup = (extra: Partial<React.ComponentProps<typeof RankingExplorer>> = {}) => render(<RankingExplorer rows={rows} metric="population-most" columnLabel="人口" isList={false} metrics={metrics} {...extra} />);

describe("コンパクトな地域別順位表", () => {
  it("表の前の短い回答は初期状態だけに表示し、検索結果の1位と混同させない", () => {
    setup({ tableIntro: <p>県内の1位と基準日</p> });
    expect(screen.getByText("県内の1位と基準日")).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "東京の街120" } });
    expect(screen.queryByText("県内の1位と基準日")).toBeNull();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
    expect(screen.getByText("県内の1位と基準日")).toBeTruthy();
  });
  it("上位10件を二重掲載せず、広告より前に表示する", () => {
    const { container } = setup();
    expect(screen.getAllByText("東京の街1")).toHaveLength(1);
    expect(container.querySelector("details summary")?.textContent).toContain("残り90件");
    const grid = container.querySelector(".rk-explorer-grid")!;
    expect(grid.children[0].querySelectorAll("tbody tr")).toHaveLength(10);
    expect(grid.children[1].querySelector("aside")).not.toBeNull();
  });
  it("全国上位100件より下も検索でき、元の順位を保つ", () => {
    setup(); fireEvent.change(screen.getByRole("searchbox"), { target: { value: "東京の街120" } });
    expect(screen.getByRole("row", { name: /120.*東京の街120/ })).toBeTruthy();
    expect(screen.queryByText("東京の街1")).toBeNull();
  });
  it("関東クエリを復元して関東全件から表示し、指標変更でも範囲を保つ", () => {
    window.history.replaceState(null, "", "/ranking/population-most?region=kanto");
    const { container } = setup({ rows: [...Array.from({ length: 110 }, (_, i) => ({ code: `27${String(i).padStart(3, "0")}`, name: `大阪の街${i}`, pref: "osaka", value: "200人" })), rows[119]] });
    expect(screen.getByRole("heading", { name: "関東のランキング" })).toBeTruthy();
    expect(container.querySelector("tbody tr td")?.textContent).toBe("1");
    expect(screen.getByTestId("share").getAttribute("data-path")).toBe("/ranking/population-most?region=kanto");
    expect(screen.getByTestId("feedback").getAttribute("data-page")).toBe("ranking:population-most:region:kanto");
    fireEvent.change(screen.getByLabelText("調べる指標"), { target: { value: "stations" } });
    expect(mocked.navigate).toHaveBeenCalledWith("/ranking/stations?region=kanto");
  });
  it("県別URLに地方クエリを加えても、県のデータを地方全件と誤表示しない", () => {
    window.history.replaceState(null, "", "/ranking/population-most/tokyo?region=kanto");
    setup({ initialPref: "tokyo" });
    expect(screen.getByRole("heading", { name: "東京都のランキング" })).toBeTruthy();
    expect(screen.getByTestId("share").getAttribute("data-path")).toBe("/ranking/population-most/tokyo");
  });
  it("一覧型に順位や上位比較を付けない", () => {
    setup({ isList: true });
    expect(screen.getAllByRole("columnheader", { name: "掲載順" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("columnheader", { name: "順位" })).toBeNull();
    expect(screen.queryByRole("link", { name: /上位.*比較/ })).toBeNull();
  });
});
