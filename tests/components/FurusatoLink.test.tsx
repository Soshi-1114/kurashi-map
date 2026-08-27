// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { FurusatoLink } from "@/components/area/FurusatoLink";
import type { FurusatoLinkInfo } from "@/lib/monetization";

afterEach(cleanup);

// アフィリエイト導線のコンプライアンス（広告明示 + rel="sponsored" + AT計測ピクセル）と、
// リンク種別（municipal / portal）に応じた文言の切り替えを守る。
// 表示可否（env・ふるなび未掲載）はサーバー側 furusatoLink の担当（lib テストで担保）。
describe("FurusatoLink", () => {
  const municipal: FurusatoLinkInfo = {
    url: "https://h.accesstrade.net/sp/cc?rk=abc&url=x",
    kind: "municipal",
    impressionPixel: "https://h.accesstrade.net/sp/rr?rk=abc",
  };

  it("municipal: 自治体名入りの文言・広告表記・rel=sponsored・計測ピクセル", () => {
    const { container, getByText } = render(
      <FurusatoLink link={municipal} targetName="札幌市" municipalityCode="01100" />,
    );
    getByText("札幌市のふるさと納税を見る");
    expect(container.textContent).toContain("広告");
    const a = container.querySelector("a");
    expect(a?.getAttribute("href")).toBe(municipal.url);
    expect(a?.getAttribute("rel")).toContain("sponsored");
    expect(a?.getAttribute("rel")).toContain("noopener");
    // AT はリファラで掲載サイトを確認するため noreferrer は付けない
    expect(a?.getAttribute("rel")).not.toContain("noreferrer");
    expect(a?.getAttribute("referrerpolicy")).toBe("no-referrer-when-downgrade");
    // AT のインプレッション計測ピクセル（sp/rr）をリンクと対で描画する
    expect(container.querySelector('img[src="https://h.accesstrade.net/sp/rr?rk=abc"]')).not.toBeNull();
  });

  it("portal: 応援文言に切り替わり、ピクセル null なら計測画像を描画しない", () => {
    const portal: FurusatoLinkInfo = { url: "https://example.com/", kind: "portal", impressionPixel: null };
    const { container, getByText } = render(
      <FurusatoLink link={portal} targetName="札幌市" municipalityCode="01100" />,
    );
    getByText("ふるさと納税で札幌市を応援する");
    expect(container.textContent).toContain("寄付先は移動先で選択できます");
    expect(container.querySelector("img[width='1']")).toBeNull();
  });
});
