// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { FurusatoLink } from "@/components/area/FurusatoLink";

const KEYS = ["NEXT_PUBLIC_FURUSATO_URL_TEMPLATE", "NEXT_PUBLIC_FURUSATO_AFF_URL"] as const;
afterEach(() => {
  cleanup();
  for (const k of KEYS) delete process.env[k];
});

// アフィリエイト導線のコンプライアンス（広告明示 + rel="sponsored"）と、
// リンク形式（search / portal）に応じた文言の切り替えを守る。
describe("FurusatoLink", () => {
  it("env 未設定なら何も描画しない", () => {
    const { container } = render(
      <FurusatoLink targetName="札幌市" prefName="北海道" municipalityCode="01100" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("検索テンプレート: 自治体名入りの文言・広告表記・rel=sponsored", () => {
    process.env.NEXT_PUBLIC_FURUSATO_URL_TEMPLATE = "https://furunavi.example/search?q={keyword}";
    const { container, getByText } = render(
      <FurusatoLink targetName="札幌市" prefName="北海道" municipalityCode="01100" />,
    );
    getByText("札幌市のふるさと納税を見る");
    expect(container.textContent).toContain("広告");
    const a = container.querySelector("a");
    expect(a?.getAttribute("rel")).toContain("sponsored");
    expect(a?.getAttribute("rel")).toContain("noopener");
    expect(a?.getAttribute("href")).toContain(encodeURIComponent("北海道札幌市"));
  });

  it("固定リンク: 応援文言になり、ASPリンクへそのまま張る", () => {
    process.env.NEXT_PUBLIC_FURUSATO_AFF_URL = "https://h.accesstrade.net/sp/cc?rk=abc";
    const { container, getByText } = render(
      <FurusatoLink targetName="札幌市" prefName="北海道" municipalityCode="01100" />,
    );
    getByText("ふるさと納税で札幌市を応援する");
    expect(container.textContent).toContain("広告");
    expect(container.querySelector("a")?.getAttribute("href")).toBe(
      "https://h.accesstrade.net/sp/cc?rk=abc",
    );
  });
});
