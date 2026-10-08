// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CompareCandidateButton, CompareSelectionProvider } from "@/components/compare/CompareSelectionProvider";

vi.mock("next/navigation", () => ({ usePathname: () => "/ranking/population-growth" }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) =>
    <a href={href} {...props}>{children}</a>,
}));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

function TestSelection() {
  return (
    <CompareSelectionProvider>
      <CompareCandidateButton code="11201" name="川越市" pref="埼玉県" source="area_detail" />
      <CompareCandidateButton code="11202" name="熊谷市" pref="埼玉県" source="map" />
      <CompareCandidateButton code="11203" name="川口市" pref="埼玉県" source="ranking_row" />
      <CompareCandidateButton code="11204" name="所沢市" pref="埼玉県" source="ranking_row" />
    </CompareSelectionProvider>
  );
}

describe("比較候補の操作", () => {
  it("3件まで選択してURLへ渡し、追加・解除状態を表示する", async () => {
    const user = userEvent.setup();
    render(<TestSelection />);
    const addButtons = await screen.findAllByRole("button", { name: "比較に追加" });
    await user.click(addButtons[0]);
    await user.click(addButtons[1]);
    await user.click(addButtons[2]);
    await waitFor(() => expect(screen.getByText("3件選択中")).toBeTruthy());
    expect(screen.getByRole("link", { name: "3件を比較" }).getAttribute("href"))
      .toBe("/compare?codes=11201,11202,11203&from=ranking");
    expect(screen.getByRole("button", { name: "3件選択済み" }).hasAttribute("disabled")).toBe(true);
    expect(JSON.parse(sessionStorage.getItem("kurashimap.compare-candidates.v1") ?? "[]")).toHaveLength(3);
  });

  it("解除で候補数と保存内容を更新する", async () => {
    const user = userEvent.setup();
    render(<TestSelection />);
    await user.click((await screen.findAllByRole("button", { name: "比較に追加" }))[0]);
    await user.click(screen.getByRole("button", { name: "比較候補をすべて解除" }));
    await waitFor(() => expect(screen.queryByRole("complementary", { name: "比較候補" })).toBeNull());
    expect(JSON.parse(sessionStorage.getItem("kurashimap.compare-candidates.v1") ?? "[]")).toEqual([]);
  });
});
