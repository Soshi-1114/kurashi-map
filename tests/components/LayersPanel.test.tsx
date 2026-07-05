// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LayersPanel from "@/components/map/LayersPanel";
import { EMPTY_FILTERS } from "@/lib/mapFilters";
import { DEFAULT_BASEMAP } from "@/lib/mapBasemaps";
import type { OverlayKey } from "@/components/map/mapConstants";

afterEach(cleanup);

function setup(overrides: Partial<React.ComponentProps<typeof LayersPanel>> = {}) {
  const props = {
    open: true,
    onToggleOpen: vi.fn(),
    activeMetric: "none" as const,
    onChangeMetric: vi.fn(),
    basemap: DEFAULT_BASEMAP,
    onChangeBasemap: vi.fn(),
    overlays: new Set<OverlayKey>(),
    onClearOverlays: vi.fn(),
    onToggleOverlay: vi.fn(),
    filters: EMPTY_FILTERS,
    onChangeFilters: vi.fn(),
    onClearFilters: vi.fn(),
    filterActive: false,
    matchedCount: 0,
    ...overrides,
  };
  render(<LayersPanel {...props} />);
  return props;
}

describe("LayersPanel", () => {
  it("閉じているときはパネル本体を描画しない（トグルボタンのみ）", () => {
    setup({ open: false });
    expect(screen.queryByText("塗り分け指標")).toBeNull();
    expect(screen.getByRole("button", { name: /表示設定/ })).toBeInTheDocument();
  });

  it("開いていると指標ラジオ・ハザード・絞り込みを描画する", () => {
    setup();
    expect(screen.getByText("塗り分け指標")).toBeInTheDocument();
    expect(screen.getByText("ハザードマップ")).toBeInTheDocument();
    expect(screen.getByText("絞り込み")).toBeInTheDocument();
  });

  it("指標ラジオの選択で onChangeMetric を呼ぶ", async () => {
    const user = userEvent.setup();
    const props = setup();
    await user.click(screen.getByText("家賃"));
    expect(props.onChangeMetric).toHaveBeenCalledWith("rent");
  });

  it("「なし」ラジオで onChangeMetric('none') を呼ぶ", async () => {
    const user = userEvent.setup();
    const props = setup({ activeMetric: "rent" });
    // ハザードの「なし」と重複するため、指標ラジオグループ内の「なし」を対象にする
    const radiogroup = screen.getByRole("radiogroup", { name: "塗り分け指標" });
    const radios = radiogroup.querySelectorAll('input[type="radio"]');
    // 指標ラジオ群の末尾が「なし」
    await user.click(radios[radios.length - 1]);
    expect(props.onChangeMetric).toHaveBeenCalledWith("none");
  });

  it("ハザード種別トグルで onToggleOverlay を呼ぶ", async () => {
    const user = userEvent.setup();
    const props = setup();
    await user.click(screen.getByRole("button", { name: "浸水" }));
    expect(props.onToggleOverlay).toHaveBeenCalledWith("flood");
  });

  it("避難所トグルで onToggleOverlay('shelter') を呼ぶ", async () => {
    const user = userEvent.setup();
    const props = setup();
    await user.click(screen.getByRole("button", { name: "避難所" }));
    expect(props.onToggleOverlay).toHaveBeenCalledWith("shelter");
  });

  it("ハザード「なし」で onClearOverlays を呼ぶ", async () => {
    const user = userEvent.setup();
    const props = setup({ overlays: new Set<OverlayKey>(["flood"]) });
    const hazardGroup = screen.getByRole("group", { name: "ハザードマップ" });
    const noneBtn = Array.from(hazardGroup.querySelectorAll("button")).find((b) => b.textContent === "なし");
    await user.click(noneBtn as Element);
    expect(props.onClearOverlays).toHaveBeenCalledTimes(1);
  });

  it("トグルボタンのクリックで onToggleOpen を呼ぶ", async () => {
    const user = userEvent.setup();
    const props = setup();
    await user.click(screen.getByRole("button", { name: /表示設定/ }));
    expect(props.onToggleOpen).toHaveBeenCalledTimes(1);
  });

  it("filterActive のとき該当件数とクリアボタンを出し、クリアで onClearFilters を呼ぶ", async () => {
    const user = userEvent.setup();
    const props = setup({ filterActive: true, matchedCount: 1234 });
    expect(screen.getByText("1,234")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "クリア" }));
    expect(props.onClearFilters).toHaveBeenCalledTimes(1);
  });

  it("filterActive でないとき該当件数を出さない", () => {
    setup({ filterActive: false });
    expect(screen.queryByText(/全国該当/)).toBeNull();
  });
});
