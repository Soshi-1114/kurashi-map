// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ContentFeedback from "@/components/ContentFeedback";
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const initial = { available: true, counts: { yes: 3, no: 2 }, voted: false, token: "signed" };

describe("情報の有用性アンケート", () => {
  it("保存先未設定では投票フォームや架空の件数を表示しない", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ available: false })); vi.stubGlobal("fetch", fetcher);
    const { container } = render(<ContentFeedback page="ranking:stations" section="ranking" />);
    await waitFor(() => expect(fetcher).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });
  it("保存失敗で件数を増やさず、再試行できる", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(initial)).mockResolvedValueOnce(Response.json({ error: "offline" }, { status: 503 })).mockResolvedValueOnce(Response.json({ voted: true, counts: { yes: 4, no: 2 } }));
    vi.stubGlobal("fetch", fetcher);
    render(<ContentFeedback page="ranking:stations" section="ranking" />);
    fireEvent.click(await screen.findByRole("button", { name: "分かった" }));
    await screen.findByRole("alert");
    expect(screen.getByText(/この版の回答：5件/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "分かった" }));
    await screen.findByText(/回答を受け付けました/);
    expect(screen.getByText(/この版の回答：6件/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "分かった" })).toBeNull();
  });
  it("否定理由は任意で、回答するまでは送信しない", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(initial)).mockResolvedValueOnce(Response.json({ voted: true, counts: { yes: 3, no: 3 } })); vi.stubGlobal("fetch", fetcher);
    render(<ContentFeedback page="ranking:stations" section="ranking" />);
    fireEvent.click(await screen.findByRole("button", { name: "分からなかった" }));
    expect(fetcher).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "理由を選ばず回答する" }));
    await screen.findByText(/回答を受け付けました/);
    const body = JSON.parse(fetcher.mock.calls[1][1].body);
    expect(body.answer).toBe("no");
    expect(body.reason).toBeUndefined();
  });
});
