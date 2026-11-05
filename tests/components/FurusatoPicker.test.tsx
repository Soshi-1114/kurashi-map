// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import FurusatoPicker from "@/components/monetization/FurusatoPicker";
const choices = [{ code: "01100", name: "札幌市", label: "北海道 札幌市", link: { url: "https://example.com/sapporo", kind: "municipal" as const, impressionPixel: "https://example.com/pixel" } }, { code: "01202", name: "函館市", label: "北海道 函館市", link: { url: "https://example.com/hakodate", kind: "municipal" as const, impressionPixel: null } }];
afterEach(() => { cleanup(); delete window.gtag; });
describe("寄付先を選んでから外部へ進む", () => {
  it("自動推薦せず、選んだ自治体と一致するリンクを表示する", () => {
    window.gtag = vi.fn();
    render(<FurusatoPicker choices={choices} fallback={{ url: "https://example.com/", kind: "portal", impressionPixel: null }} />);
    expect((screen.getByLabelText("応援したい自治体") as HTMLSelectElement).value).toBe("");
    expect(screen.queryByRole("link", { name: "ふるなびで札幌市を見る" })).toBeNull();
    fireEvent.change(screen.getByLabelText("応援したい自治体"), { target: { value: "01100" } });
    expect(screen.getByRole("link", { name: "ふるなびで札幌市を見る" }).getAttribute("href")).toBe(choices[0].link.url);
    fireEvent.change(screen.getByLabelText("応援したい自治体"), { target: { value: "01202" } });
    const link = screen.getByRole("link", { name: "ふるなびで函館市を見る" });
    expect(link.getAttribute("rel")).toBe("sponsored nofollow noopener");
    expect(link.getAttribute("referrerpolicy")).toBe("no-referrer-when-downgrade");
    fireEvent.click(link);
    expect(window.gtag).toHaveBeenCalledWith("event", "furusato_link_click", expect.objectContaining({ municipality_code: "01202", cta_variant: "donation-select-v1", measurement_version: "2026-10-31" }));
    expect(screen.queryByRole("link", { name: "ふるなびで札幌市を見る" })).toBeNull();
  });
});
