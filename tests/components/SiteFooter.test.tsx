// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import SiteFooter from "@/components/SiteFooter";
import { MAP_HUBS } from "@/lib/siteNav";

afterEach(cleanup);

// 共通フッターは半孤立だったハブへの内部リンク底上げが目的なので、
// その導線が silent に欠落しないことを単一ソース（MAP_HUBS）から導出して守る。
describe("SiteFooter", () => {
  it("footer ランドマークで、地図ハブ全件と /denki への導線を持つ", () => {
    const { container } = render(<SiteFooter />);
    expect(container.querySelector("footer")).not.toBeNull();
    const hrefs = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    for (const { href } of MAP_HUBS) {
      expect(hrefs, href).toContain(href);
    }
    expect(hrefs).toContain("/denki");
  });
});
