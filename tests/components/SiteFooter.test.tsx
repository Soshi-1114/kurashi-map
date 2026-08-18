// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import SiteFooter from "@/components/SiteFooter";

afterEach(cleanup);

// 共通フッターは内部リンクグラフの底上げが目的なので、
// ハブ導線が silent に欠落しないことをリンク集合で守る。
describe("SiteFooter", () => {
  it("footer ランドマークで、地図ハブ5本・denki・ranking・about への導線を持つ", () => {
    render(<SiteFooter />);
    const footer = screen.getByRole("contentinfo");
    const hrefs = Array.from(footer.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    for (const path of [
      "/map/rent",
      "/map/land-price",
      "/map/population-trend",
      "/map/future-population",
      "/map/foreign-ratio",
      "/denki",
      "/ranking",
      "/compare",
      "/about",
      "/privacy",
    ]) {
      expect(hrefs, path).toContain(path);
    }
  });
});
