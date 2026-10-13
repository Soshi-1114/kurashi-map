// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HomeShell from "@/components/HomeShell";

vi.mock("@/components/MapView", () => ({
  default: ({ onMenuClick, menuOpen, menuId }: { onMenuClick: (opener: HTMLButtonElement) => void; menuOpen: boolean; menuId: string }) =>
    <button aria-expanded={menuOpen} aria-controls={menuId} onClick={(event) => onMenuClick(event.currentTarget)}>メニューを開く</button>,
}));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("地図メニューのキーボード操作", () => {
  it("閉じた説明を操作対象から外し、開くとフォーカスを移す", async () => {
    const user = userEvent.setup();
    const { container } = render(<HomeShell summary={[]}><a href="/about">データの説明</a></HomeShell>);
    expect(container.querySelector("aside")).toHaveAttribute("inert");
    await user.click(screen.getByRole("button", { name: "メニューを開く" }));
    expect(container.querySelector("aside")).not.toHaveAttribute("inert");
    expect(screen.getByRole("button", { name: "メニューを閉じる" })).toHaveFocus();
    expect(container.querySelector(".home-map")).toHaveAttribute("inert");
    const opener = screen.getByRole("button", { name: "メニューを開く" });
    expect(opener).toHaveAttribute("aria-expanded", "true");
    expect(opener.getAttribute("aria-controls")).toBe(container.querySelector("aside")?.id);
  });

  it("Tabでメニュー内を循環し、Escapeで起点へ戻る", async () => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0));
    vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id));
    const user = userEvent.setup();
    render(<HomeShell summary={[]}><a href="/about">データの説明</a><div hidden><a href="/privacy">非選択パネル</a></div></HomeShell>);
    const open = screen.getByRole("button", { name: "メニューを開く" });
    await user.click(open);
    await user.tab({ shift: true });
    expect(screen.getByRole("link", { name: "データの説明" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "メニューを閉じる" })).toHaveFocus();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(open).toHaveFocus());
  });

  it("クリックでボタンにfocusが移らなくても、閉じると起点へ戻る", async () => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0));
    vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id));
    render(<HomeShell summary={[]}><a href="/about">データの説明</a></HomeShell>);
    const opener = screen.getByRole("button", { name: "メニューを開く" });
    expect(document.activeElement).toBe(document.body);
    fireEvent.click(opener);
    fireEvent.click(screen.getByRole("button", { name: "メニューを閉じる" }));
    await waitFor(() => expect(opener).toHaveFocus());
    expect(opener).toHaveAttribute("aria-expanded", "false");
  });

  it("スクロール後に開き直すと説明の先頭に戻る", async () => {
    const user = userEvent.setup();
    const { container } = render(<HomeShell summary={[]}><a href="/about">データの説明</a></HomeShell>);
    const opener = screen.getByRole("button", { name: "メニューを開く" });
    await user.click(opener);
    const content = container.querySelector<HTMLElement>(".home-nav-content")!;
    content.scrollTop = 400;
    await user.click(screen.getByRole("button", { name: "メニューを閉じる" }));
    await user.click(opener);
    expect(content.scrollTop).toBe(0);
  });
});
