import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/content-feedback/route";
import { FEEDBACK_VERSION } from "@/lib/contentFeedback";
import { feedbackSignature, validFeedbackTarget, verifyFeedbackSignature } from "@/lib/contentFeedbackServer";

const secret = "test-secret-32-characters-long-for-tests";
const browser = "d3ba5a7d-711b-4b69-81d8-4b4cba467191";
const target = { page: "ranking:stations:region:kanto", section: "ranking" as const, version: FEEDBACK_VERSION };
const token = () => feedbackSignature(secret, browser, target);
function request(body: unknown = { ...target, answer: "yes" }, overrides: Record<string, string> = {}) {
  return new NextRequest("https://kurashimap.jp/api/content-feedback", { method: "POST", headers: { origin: "https://kurashimap.jp", cookie: `kurashimap_feedback=${browser}`, "content-type": "application/json", "x-feedback-token": token(), ...overrides }, body: JSON.stringify(body) });
}
beforeEach(() => {
  vi.stubEnv("FEEDBACK_ENABLED", "true");
  vi.stubEnv("FEEDBACK_REDIS_REST_URL", "https://redis.example.test");
  vi.stubEnv("FEEDBACK_REDIS_REST_TOKEN", "private-test-token");
  vi.stubEnv("FEEDBACK_SIGNING_SECRET", secret);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("有用性回答のAPI", () => {
  it("未設定時は無効を返し、保存先へ通信しない", async () => {
    vi.stubEnv("FEEDBACK_ENABLED", "false");
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const response = await GET(new NextRequest("https://kurashimap.jp/api/content-feedback"));
    expect(await response.json()).toEqual({ available: false });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("実在しない対象・項目・版・自治体を受け付けない", async () => {
    for (const value of [{ ...target, page: "ranking:missing" }, { ...target, section: "overview" }, { ...target, version: "old" }, { ...target, page: "area:tokyo:13999", section: "overview" }]) expect(await validFeedbackTarget(value)).toBeNull();
    expect(await validFeedbackTarget({ ...target, page: "area:ibaraki:08201", section: "overview" })).not.toBeNull();
  });
  it("別ページや別ブラウザーへ署名を転用できない", () => {
    expect(verifyFeedbackSignature(secret, browser, target, token())).toBe(true);
    expect(verifyFeedbackSignature(secret, browser, { ...target, page: "ranking:preschools" }, token())).toBe(false);
    expect(verifyFeedbackSignature(secret, "other", target, token())).toBe(false);
    expect(verifyFeedbackSignature(secret, browser, target, "x")).toBe(false);
  });
  it("同一Origin・Cookie・署名がない送信は保存前に拒否する", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    for (const headers of [{ origin: "https://elsewhere.test" }, { origin: "" }, { cookie: "" }, { "x-feedback-token": "invalid" }]) expect((await POST(request(undefined, headers))).status).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("不正な回答・任意理由・過大な本文を拒否する", async () => {
    for (const body of [{ ...target, answer: "maybe" }, { ...target, answer: "yes", reason: "missing" }, { ...target, answer: "no", reason: "free text" }, { ...target, answer: "no", padding: "x".repeat(3000) }, null]) expect((await POST(request(body))).status).toBe(400);
  });
  it("読み取りをキャッシュさせず、匿名Cookieと署名を返す", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      const command = JSON.parse(init.body);
      return Response.json({ result: command[0] === "HMGET" ? ["3", "2"] : 0 });
    }));
    const query = new URLSearchParams(target);
    const response = await GET(new NextRequest(`https://kurashimap.jp/api/content-feedback?${query}`));
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("set-cookie")).toMatch(/HttpOnly/);
    expect(response.headers.get("set-cookie")).toMatch(/Secure/);
    expect(await response.json()).toMatchObject({ counts: { yes: 3, no: 2 }, available: true, voted: false });
  });
  it("原子的な保存結果だけを返し、重複・連投制限を区別する", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ result: [1, 4, 2] })).mockResolvedValueOnce(Response.json({ result: [2, 4, 2] })).mockResolvedValueOnce(Response.json({ result: [3, 4, 2] }));
    vi.stubGlobal("fetch", fetcher);
    expect(await (await POST(request())).json()).toMatchObject({ counts: { yes: 4, no: 2 }, duplicate: false, voted: true });
    expect(await (await POST(request())).json()).toMatchObject({ counts: { yes: 4, no: 2 }, duplicate: true });
    expect((await POST(request())).status).toBe(429);
    const args = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(args[0]).toBe("EVAL");
    expect(args[2]).toBe(3);
    expect(args.join(" ")).not.toContain(browser);
  });
  it("保存先の障害・不正カウントを成功扱いにしない", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "backend failed" })));
    expect((await POST(request())).status).toBe(503);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ result: [1, -1, 2] })));
    expect((await POST(request())).status).toBe(503);
  });
});
