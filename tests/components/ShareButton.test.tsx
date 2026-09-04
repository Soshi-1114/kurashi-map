// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent, act } from "@testing-library/react";
import { ShareButton } from "@/components/ShareButton";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  delete (window as { gtag?: unknown }).gtag;
  delete (navigator as { share?: unknown }).share;
  delete (navigator as { clipboard?: unknown }).clipboard;
});

// Web Share API があれば共有シート、なければクリップボードコピーに切り替わることと、
// GA4 share イベント（method / content_type / item_id）の送信を守る。
describe("ShareButton", () => {
  const props = {
    title: "東京都千代田区の住みやすさ｜KurashiMap",
    path: "/area/tokyo/13101",
    contentType: "area",
    itemId: "13101",
    label: "このページを共有",
  };

  it("Web Share あり: path を絶対URLにして共有し、share イベント（web_share）を送る", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share });
    const gtag = vi.fn();
    window.gtag = gtag;

    const { getByRole } = render(<ShareButton {...props} />);
    await act(async () => {
      fireEvent.click(getByRole("button", { name: "このページを共有" }));
    });

    expect(share).toHaveBeenCalledWith({
      title: props.title,
      url: `${window.location.origin}/area/tokyo/13101`,
    });
    expect(gtag).toHaveBeenCalledWith("event", "share", {
      method: "web_share",
      content_type: "area",
      item_id: "13101",
    });
  });

  it("Web Share キャンセル時（AbortError）は計測しない", async () => {
    Object.assign(navigator, { share: vi.fn().mockRejectedValue(new DOMException("cancel", "AbortError")) });
    const gtag = vi.fn();
    window.gtag = gtag;

    const { getByRole } = render(<ShareButton {...props} />);
    await act(async () => {
      fireEvent.click(getByRole("button"));
    });
    expect(gtag).not.toHaveBeenCalled();
  });

  it("Web Share なし: クリップボードへコピーし、完了表示と share イベント（copy）を出す", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const gtag = vi.fn();
    window.gtag = gtag;

    const { getByRole, getByText } = render(<ShareButton {...props} />);
    await act(async () => {
      fireEvent.click(getByRole("button"));
    });

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/area/tokyo/13101`);
    getByText("リンクをコピーしました");
    expect(gtag).toHaveBeenCalledWith("event", "share", {
      method: "copy",
      content_type: "area",
      item_id: "13101",
    });
  });

  it("コピー完了表示は2秒で元のラベルに戻る", async () => {
    vi.useFakeTimers();
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });

    const { getByRole, getByText } = render(<ShareButton {...props} />);
    await act(async () => {
      fireEvent.click(getByRole("button"));
    });
    getByText("リンクをコピーしました");

    await act(async () => {
      vi.advanceTimersByTime(2100);
    });
    getByText("このページを共有");
  });

  it("クリップボード拒否時は完了表示を出さず計測もしない", async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    const gtag = vi.fn();
    window.gtag = gtag;

    const { getByRole, getByText } = render(<ShareButton {...props} />);
    await act(async () => {
      fireEvent.click(getByRole("button"));
    });
    getByText("このページを共有");
    expect(gtag).not.toHaveBeenCalled();
  });

  it("path 省略時は現在のURLを共有する（比較ページの ?codes= 状態共有）", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    const { getByRole } = render(
      <ShareButton title="自治体を比較" contentType="compare" itemId="compare" />,
    );
    await act(async () => {
      fireEvent.click(getByRole("button"));
    });
    expect(writeText).toHaveBeenCalledWith(window.location.href);
  });
});
