// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MuniSearch from "@/components/map/MuniSearch";
import { muniSummary } from "../_fixtures";

afterEach(cleanup);

const kawaguchi = muniSummary({ code: "11203", name: "川口市", rent: 73473 });
const kawagoe = muniSummary({ code: "11201", name: "川越市", rent: 58000 });
const noRent = muniSummary({ code: "11464", name: "東秩父村", rent: 0 });
// 政令市の区（displayName から親市名を導出する分岐の確認用）
const urawa = muniSummary({
  code: "11107", name: "浦和区", level: "ward", parentCode: "11100",
  displayName: "さいたま市浦和区",
});

function setup(onSelect = vi.fn()) {
  const munis = [kawaguchi, kawagoe, noRent];
  render(<MuniSearch municipalities={munis} wards={[urawa]} onSelect={onSelect} />);
  return { onSelect, input: screen.getByRole("combobox") };
}

describe("MuniSearch", () => {
  it("初期状態では候補リストを出さない", () => {
    setup();
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("入力した文字で候補を絞り込む", async () => {
    const user = userEvent.setup();
    const { input } = setup();
    await user.type(input, "川");
    const options = screen.getAllByRole("option");
    // 「川口市」「川越市」の2件（東秩父村は含まれない）
    expect(options).toHaveLength(2);
    expect(screen.getByText("川口市")).toBeInTheDocument();
    expect(screen.getByText("川越市")).toBeInTheDocument();
    expect(screen.queryByText("東秩父村")).toBeNull();
  });

  it("候補に都道府県名のコンテキストを添える（同名自治体の誤選択防止）", async () => {
    const user = userEvent.setup();
    const { input } = setup();
    await user.type(input, "川口");
    const option = screen.getByRole("option");
    expect(within(option).getByText("埼玉県")).toBeInTheDocument();
  });

  it("政令市の区は「県名 市名」をコンテキストに出す", async () => {
    const user = userEvent.setup();
    const { input } = setup();
    await user.type(input, "浦和");
    const option = screen.getByRole("option");
    expect(within(option).getByText("埼玉県 さいたま市")).toBeInTheDocument();
  });

  it("家賃データなしの自治体は候補で「—」を表示する", async () => {
    const user = userEvent.setup();
    const { input } = setup();
    await user.type(input, "東秩父");
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("↓キーで候補をハイライトし Enter で確定、onSelect に自治体を渡す", async () => {
    const user = userEvent.setup();
    const { input, onSelect } = setup();
    await user.type(input, "川");
    await user.keyboard("{ArrowDown}");
    const first = screen.getAllByRole("option")[0];
    expect(first).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ code: "11203" }));
  });

  it("Enter は未ハイライト（activeIndex<0）では確定しない", async () => {
    const user = userEvent.setup();
    const { input, onSelect } = setup();
    await user.type(input, "川");
    await user.keyboard("{Enter}");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("候補クリックで確定し、入力をクリアして候補を閉じる", async () => {
    const user = userEvent.setup();
    const { input, onSelect } = setup();
    await user.type(input, "川口");
    await user.click(screen.getByRole("option"));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ code: "11203" }));
    expect((input as HTMLInputElement).value).toBe("");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("Escape で入力をクリアして候補を閉じる", async () => {
    const user = userEvent.setup();
    const { input } = setup();
    await user.type(input, "川");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect((input as HTMLInputElement).value).toBe("");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("combobox の aria-expanded が候補の有無に追従する", async () => {
    const user = userEvent.setup();
    const { input } = setup();
    expect(input).toHaveAttribute("aria-expanded", "false");
    await user.type(input, "川");
    expect(input).toHaveAttribute("aria-expanded", "true");
  });
});
