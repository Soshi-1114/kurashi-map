// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SectionNav from "@/components/area/SectionNav";

const ITEMS = [
  { id: "overview", label: "概要" },
  { id: "data", label: "データ" },
  { id: "ranking", label: "ランキング" },
];

/** jsdom には IntersectionObserver が無いので最小限のスタブを置く。 */
function stubIntersectionObserver() {
  const observe = vi.fn();
  const disconnect = vi.fn();
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe = observe;
      disconnect = disconnect;
      unobserve = vi.fn();
      takeRecords = vi.fn(() => []);
      constructor(_cb: IntersectionObserverCallback) {}
    },
  );
  return { observe, disconnect };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete (window as { gtag?: unknown }).gtag;
});

beforeEach(() => {
  // アンカー先が実在する状態を作る（IO の監視対象になる）
  document.body.innerHTML = "";
  for (const i of ITEMS) {
    const el = document.createElement("div");
    el.id = i.id;
    document.body.appendChild(el);
  }
});

describe("SectionNav", () => {
  it("全項目を素のアンカーリンクとして描画する（JS 無しでも辿れる）", () => {
    stubIntersectionObserver();
    render(<SectionNav items={ITEMS} municipalityCode="40220" />);
    for (const i of ITEMS) {
      const link = screen.getByRole("link", { name: i.label });
      expect(link).toHaveAttribute("href", `#${i.id}`);
    }
  });

  it("nav にアクセシブル名があり、tablist ではない", () => {
    stubIntersectionObserver();
    render(<SectionNav items={ITEMS} municipalityCode="40220" />);
    expect(screen.getByRole("navigation", { name: "このページの目次" })).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("初期状態は先頭項目が現在地", () => {
    stubIntersectionObserver();
    render(<SectionNav items={ITEMS} municipalityCode="40220" />);
    expect(screen.getByRole("link", { name: "概要" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "データ" })).not.toHaveAttribute("aria-current");
  });

  it("クリックで現在地が移り、GA4 に select_section を送る", async () => {
    stubIntersectionObserver();
    const gtag = vi.fn();
    (window as { gtag?: unknown }).gtag = gtag;
    render(<SectionNav items={ITEMS} municipalityCode="40220" />);

    await userEvent.click(screen.getByRole("link", { name: "ランキング" }));

    expect(screen.getByRole("link", { name: "ランキング" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "概要" })).not.toHaveAttribute("aria-current");
    expect(gtag).toHaveBeenCalledWith("event", "select_section", {
      section: "ranking",
      municipality_code: "40220",
    });
  });

  it("IntersectionObserver が無い環境でも落ちず、リンクは生きている", () => {
    // スタブを置かない＝ jsdom の素の状態（IntersectionObserver 未定義）
    expect(() => render(<SectionNav items={ITEMS} municipalityCode="40220" />)).not.toThrow();
    expect(screen.getAllByRole("link")).toHaveLength(ITEMS.length);
  });

  it("項目が空なら何も描画しない", () => {
    stubIntersectionObserver();
    const { container } = render(<SectionNav items={[]} municipalityCode="40220" />);
    expect(container).toBeEmptyDOMElement();
  });
});
