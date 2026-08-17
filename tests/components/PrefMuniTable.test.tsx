// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PrefMuniTable, type PrefMuniRow } from "@/components/area/PrefMuniTable";

afterEach(() => cleanup());

const ROWS: PrefMuniRow[] = [
  { code: "11100", pref: "saitama", label: "さいたま市", rent: 70000, landPrice: 300000, population: 1300000 },
  { code: "11201", pref: "saitama", label: "川越市", rent: 50000, landPrice: 150000, population: 350000 },
  { code: "11202", pref: "saitama", label: "熊谷市", rent: 0, landPrice: 100000, population: 190000 }, // 家賃データなし
];

function rowLabels() {
  return screen.getAllByRole("row").slice(1).map((row) => row.querySelector("th")?.textContent);
}

describe("PrefMuniTable", () => {
  it("初期表示は渡された順序のまま", () => {
    render(<PrefMuniTable rows={ROWS} />);
    expect(rowLabels()).toEqual(["さいたま市", "川越市", "熊谷市"]);
  });

  it("家賃平均クリックで昇順。データなし（家賃0）は末尾に固定", async () => {
    const user = userEvent.setup();
    render(<PrefMuniTable rows={ROWS} />);
    await user.click(screen.getByRole("button", { name: /家賃平均/ }));
    expect(rowLabels()).toEqual(["川越市", "さいたま市", "熊谷市"]);
  });

  it("同じ見出しを再クリックすると降順に切り替わる（データなしは変わらず末尾）", async () => {
    const user = userEvent.setup();
    render(<PrefMuniTable rows={ROWS} />);
    const rentHeader = screen.getByRole("button", { name: /家賃平均/ });
    await user.click(rentHeader);
    await user.click(rentHeader);
    expect(rowLabels()).toEqual(["さいたま市", "川越市", "熊谷市"]);
  });

  it("人口クリックで降順→昇順のトグルが機能する", async () => {
    const user = userEvent.setup();
    render(<PrefMuniTable rows={ROWS} />);
    const popHeader = screen.getByRole("button", { name: /人口/ });
    await user.click(popHeader);
    expect(rowLabels()).toEqual(["熊谷市", "川越市", "さいたま市"]);
    await user.click(popHeader);
    expect(rowLabels()).toEqual(["さいたま市", "川越市", "熊谷市"]);
  });

  it("別の見出しに切り替えると常に昇順から始まる", async () => {
    const user = userEvent.setup();
    render(<PrefMuniTable rows={ROWS} />);
    await user.click(screen.getByRole("button", { name: /人口/ }));
    await user.click(screen.getByRole("button", { name: /^自治体/ }));
    // 自治体名の昇順（localeCompare "ja"）。データなし行も名前列では除外されない。
    expect(rowLabels()).toEqual(["さいたま市", "熊谷市", "川越市"]);
  });
});
