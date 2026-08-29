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
    matchedMunis: [],
    onSelectMatch: vi.fn(),
    ...overrides,
  };
  const utils = render(<LayersPanel {...props} />);
  return { ...props, ...utils };
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
    const dummy = (code: string) => ({
      code, pref: "saitama", name: `市${code}`, rent: 50000, landPrice: 100000,
      populationTrend: "横ばい" as const, floodLevel: 0, landslideLevel: -1,
      tsunamiLevel: -1, stormSurgeLevel: -1, liquefactionLevel: -1,
    });
    const props = setup({
      filterActive: true,
      matchedMunis: Array.from({ length: 1234 }, (_, i) => dummy(String(11000 + i))),
    });
    expect(screen.getByText("1,234")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "クリア" }));
    expect(props.onClearFilters).toHaveBeenCalledTimes(1);
  });

  it("filterActive でないとき該当件数を出さない", () => {
    setup({ filterActive: false });
    expect(screen.queryByText(/全国該当/)).toBeNull();
  });

  it("空き家率上限・2050年人口のセグメントを描画し、選択で onChangeFilters を呼ぶ", async () => {
    const user = userEvent.setup();
    const props = setup();
    await user.click(screen.getByRole("button", { name: "〜15%" }));
    expect(props.onChangeFilters).toHaveBeenCalledWith({ ...EMPTY_FILTERS, vacancyMax: 15 });
    await user.click(screen.getByRole("button", { name: "増加見込み" }));
    expect(props.onChangeFilters).toHaveBeenCalledWith({ ...EMPTY_FILTERS, futureMin: 0 });
  });

  it("「一覧を見る」で該当自治体を県ごとに表示し、行クリックで onSelectMatch を呼ぶ", async () => {
    const user = userEvent.setup();
    const munis = [
      { code: "11203", pref: "saitama", name: "川口市", rent: 55000, landPrice: 200000, populationTrend: "横ばい" as const, floodLevel: 0, landslideLevel: -1, tsunamiLevel: -1, stormSurgeLevel: -1, liquefactionLevel: -1 },
      { code: "01100", pref: "hokkaido", name: "札幌市", rent: 50000, landPrice: 100000, populationTrend: "横ばい" as const, floodLevel: 0, landslideLevel: -1, tsunamiLevel: -1, stormSurgeLevel: -1, liquefactionLevel: -1 },
    ];
    const props = setup({ filterActive: true, matchedMunis: munis });
    await user.click(screen.getByRole("button", { name: "一覧を見る" }));
    // PREFS の並び順（北→南）でグループ化される
    expect(screen.getByText("北海道")).toBeInTheDocument();
    expect(screen.getByText("埼玉県")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "川口市" }));
    expect(props.onSelectMatch).toHaveBeenCalledWith("11203");
  });

  it("該当0件のときは「一覧を見る」を出さない", () => {
    setup({ filterActive: true, matchedMunis: [] });
    expect(screen.queryByRole("button", { name: "一覧を見る" })).toBeNull();
  });

  it("activeCount>0 のときトグルボタンに件数バッジと「設定N件適用中」を出す", () => {
    setup({ open: false, activeCount: 3 });
    const toggle = screen.getByRole("button", { name: /表示設定/ });
    expect(toggle.getAttribute("aria-label")).toContain("設定3件適用中");
    expect(toggle.textContent).toContain("3");
  });

  it("activeCount=0 のときバッジを出さない", () => {
    setup({ open: false, activeCount: 0 });
    const toggle = screen.getByRole("button", { name: /表示設定/ });
    expect(toggle.getAttribute("aria-label")).not.toContain("適用中");
  });

  it("閉じるボタンで onToggleOpen を呼ぶ", async () => {
    const user = userEvent.setup();
    const props = setup();
    await user.click(screen.getByRole("button", { name: "閉じる" }));
    expect(props.onToggleOpen).toHaveBeenCalledTimes(1);
  });

  it("Escape キーで onToggleOpen を呼ぶ", async () => {
    const user = userEvent.setup();
    const props = setup();
    await user.keyboard("{Escape}");
    expect(props.onToggleOpen).toHaveBeenCalledTimes(1);
  });

  it("isMobile のときパネルが role=dialog になり、PC では dialog にしない", () => {
    setup({ isMobile: true });
    expect(screen.getByRole("dialog", { name: "地図の表示設定" })).toBeInTheDocument();
    cleanup();
    setup({ isMobile: false });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  // html を overflow:hidden にするだけだとルートスクローラの位置が 0 に落ち、
  // 半透明の scrim 越しに背後がページ先頭へ飛んで見え、閉じても戻らない。
  it("モバイル: 現在位置ぶん body を固定してロックし、解除時に位置を戻す", () => {
    const scrollTo = vi.fn();
    const prevScrollTo = window.scrollTo;
    Object.defineProperty(window, "scrollY", { value: 900, configurable: true });
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo;

    const { unmount } = setup({ isMobile: true });
    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(document.body.style.position).toBe("fixed");
    // 見た目を据え置くため、ロック前のスクロール量ぶん引き上げる
    expect(document.body.style.top).toBe("-900px");

    // ロック中はブラウザ側でスクロール位置が 0 になる
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
    unmount();

    expect(document.documentElement.style.overflow).toBe("");
    expect(document.body.style.position).toBe("");
    expect(document.body.style.top).toBe("");
    expect(scrollTo).toHaveBeenCalledWith(0, 900);

    window.scrollTo = prevScrollTo;
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  });

  it("PC: スクロールロックをかけない", () => {
    const { unmount } = setup({ isMobile: false });
    expect(document.documentElement.style.overflow).toBe("");
    expect(document.body.style.position).toBe("");
    unmount();
  });
});
