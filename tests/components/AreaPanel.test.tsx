// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import AreaPanel from "@/components/AreaPanel";
import { muni } from "../_fixtures";
import { CompareSelectionProvider } from "@/components/compare/CompareSelectionProvider";

vi.mock("next/navigation", () => ({ usePathname: () => "/map" }));

afterEach(cleanup);

// 地図パネルの火災保険導線は「災害オーバーレイ表示中」の文脈でのみ出す契約
// （MapView が overlays.size > 0 のときだけ kasai を渡す。ここでは prop 契約を固定する）。
describe("AreaPanel の火災保険導線", () => {
  const kasai = { url: "https://px.a8.net/svt/ejp?a8mat=abc", impressionPixel: null };

  it("kasai を渡すと広告表記つきで描画され、リンク先と自治体コードを持つ", () => {
    const m = muni();
    const { container } = render(<CompareSelectionProvider><AreaPanel municipality={m} kasai={kasai} onClose={() => {}} /></CompareSelectionProvider>);
    const a = container.querySelector('a[href="https://px.a8.net/svt/ejp?a8mat=abc"]');
    expect(a).not.toBeNull();
    expect(a?.getAttribute("rel")).toContain("sponsored");
    expect(container.textContent).toContain("広告");
  });

  it("kasai が無ければ（=災害オーバーレイ非表示）導線を出さない", () => {
    const { container } = render(<CompareSelectionProvider><AreaPanel municipality={muni()} onClose={() => {}} /></CompareSelectionProvider>);
    expect(container.querySelector('a[href*="px.a8.net"]')).toBeNull();
  });
});
