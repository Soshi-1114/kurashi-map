// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PrefRegionPicker from "@/components/home/PrefRegionPicker";
import { PREFS, REGIONS } from "@/lib/prefs";

afterEach(cleanup);

describe("PrefRegionPicker", () => {
  it("地方タブを全件出し、初期は関東を選択する", () => {
    render(<PrefRegionPicker />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(REGIONS.length);
    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("関東");
  });

  // 47県のリンクは初期HTMLに全部載っている必要がある（クロール可能性の担保）。
  // 非選択の地方は hidden にするだけで、DOM からは外さない。
  it("非選択の地方も含め、47都道府県のリンクが常に DOM にある", () => {
    const { container } = render(<PrefRegionPicker />);
    const hrefs = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(hrefs).toHaveLength(PREFS.length);
    for (const p of PREFS) expect(hrefs).toContain(`/area/${p.slug}`);
  });

  it("選択中の地方のパネルだけを表示する", () => {
    render(<PrefRegionPicker />);
    const panels = screen.getAllByRole("tabpanel", { hidden: true });
    const visible = panels.filter((p) => !p.hasAttribute("hidden"));
    expect(visible).toHaveLength(1);
    expect(within(visible[0]).getByText("東京都")).toBeInTheDocument();
    // 関東以外（例: 近畿の大阪府）は隠れているのでアクセシビリティツリーに出ない
    expect(screen.queryByRole("link", { name: "大阪府" })).toBeNull();
  });

  it("地方タブを押すとその地方の都道府県に切り替わる", async () => {
    const user = userEvent.setup();
    render(<PrefRegionPicker />);
    await user.click(screen.getByRole("tab", { name: "近畿" }));
    expect(screen.getByRole("link", { name: "大阪府" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "東京都" })).toBeNull();
  });

  it("← → でタブを移動し、フォーカスも一緒に動く", async () => {
    const user = userEvent.setup();
    render(<PrefRegionPicker />);
    const kanto = screen.getByRole("tab", { name: "関東" });
    kanto.focus();
    await user.keyboard("{ArrowRight}");
    const next = screen.getByRole("tab", { selected: true });
    expect(next).toHaveTextContent("中部・北陸");
    expect(next).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("関東");
  });
});
