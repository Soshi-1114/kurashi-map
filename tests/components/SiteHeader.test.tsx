// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import SiteHeader from "@/components/SiteHeader";
import { shindanHref } from "@/lib/siteNav";

afterEach(cleanup);

// 診断（/shindan）の常設導線はフッター以外ではこのヘッダーだけなので、
// silent に欠落しないことと、tool_entry 計測用の from が付くことを守る。
describe("SiteHeader", () => {
  it("主要導線（ランキング・比較・診断）を持ち、診断は from=header で送客する", () => {
    const { container } = render(<SiteHeader />);
    const hrefs = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/ranking");
    expect(hrefs).toContain("/compare");
    expect(hrefs).toContain(shindanHref("header"));
  });

  it("SP で隠す副次導線（電気代・about）は site-header-nav-optional を持つ", () => {
    const { container } = render(<SiteHeader />);
    const optional = [...container.querySelectorAll("a.site-header-nav-optional")].map((a) =>
      a.getAttribute("href"),
    );
    expect(optional).toContain("/denki");
    expect(optional).toContain("/about");
    // 診断は SP でも出す（レポート2026-09の P0: SPヘッダーにも診断）
    expect(optional).not.toContain(shindanHref("header"));
  });
});
