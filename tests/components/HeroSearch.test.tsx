// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HeroSearch from "@/components/home/HeroSearch";
import { muniSummary } from "../_fixtures";

// トップのヒーロー検索。MuniSearch と違い、確定で詳細ページへ遷移する。
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

afterEach(cleanup);
beforeEach(() => push.mockClear());

const kawaguchi = muniSummary({ code: "11203", name: "川口市" });
const kawagoe = muniSummary({ code: "11201", name: "川越市" });
const urawa = muniSummary({
  code: "11107", name: "浦和区", level: "ward", parentCode: "11100",
  displayName: "さいたま市浦和区",
});

function setup() {
  render(<HeroSearch munis={[kawaguchi, kawagoe, urawa]} />);
  return { input: screen.getByRole("combobox") };
}

describe("HeroSearch", () => {
  it("初期状態では候補リストを出さない", () => {
    setup();
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("入力した文字で候補を絞り込み、都道府県コンテキストを添える", async () => {
    const user = userEvent.setup();
    const { input } = setup();
    await user.type(input, "川口");
    const option = screen.getByRole("option");
    expect(within(option).getByText("川口市")).toBeInTheDocument();
    expect(within(option).getByText("埼玉県")).toBeInTheDocument();
  });

  it("候補クリックで自治体詳細ページへ遷移する", async () => {
    const user = userEvent.setup();
    const { input } = setup();
    await user.type(input, "川口");
    await user.click(screen.getByRole("option"));
    expect(push).toHaveBeenCalledWith("/area/saitama/11203");
  });

  it("↓キー＋Enter で選択中の候補ページへ遷移する", async () => {
    const user = userEvent.setup();
    const { input } = setup();
    await user.type(input, "川");
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(push).toHaveBeenCalledWith("/area/saitama/11201"); // 2件目=川越市
  });

  it("政令市の区は displayName でもヒットし、遷移先は区ページ", async () => {
    const user = userEvent.setup();
    const { input } = setup();
    await user.type(input, "さいたま市浦和");
    await user.click(screen.getByRole("option"));
    expect(push).toHaveBeenCalledWith("/area/saitama/11107");
  });

  it("Escape で候補を閉じる", async () => {
    const user = userEvent.setup();
    const { input } = setup();
    await user.type(input, "川");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
