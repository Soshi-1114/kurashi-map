import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { FEEDBACK_COOKIE, feedbackConfig, feedbackSignature, readFeedback, saveFeedback, validFeedbackTarget, validFeedbackVote, verifyFeedbackSignature } from "@/lib/contentFeedbackServer";
import type { FeedbackReason } from "@/lib/contentFeedback";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", "Vary": "Cookie" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });
const validBrowser = (id?: string): id is string => typeof id === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id);

export async function GET(request: NextRequest) {
  const config = feedbackConfig();
  if (!config) return json({ available: false });
  const target = await validFeedbackTarget(Object.fromEntries(request.nextUrl.searchParams));
  if (!target) return json({ error: "invalid target" }, 400);
  const current = request.cookies.get(FEEDBACK_COOKIE)?.value;
  const browser = validBrowser(current) ? current : randomUUID();
  try {
    const result = await readFeedback(config, browser, target);
    const response = json({ available: true, ...result, token: feedbackSignature(config.secret, browser, target) });
    if (browser !== current) response.cookies.set(FEEDBACK_COOKIE, browser, { httpOnly: true, sameSite: "strict", secure: request.nextUrl.protocol === "https:", path: "/", maxAge: 365 * 86400 });
    return response;
  } catch { return json({ available: false, error: "temporarily unavailable" }, 503); }
}

async function boundedBody(request: NextRequest): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json") || !request.body) throw new Error("invalid body");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 2048) { await reader.cancel(); throw new Error("body too large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export async function POST(request: NextRequest) {
  const config = feedbackConfig();
  if (!config) return json({ available: false }, 503);
  if (request.headers.get("origin") !== request.nextUrl.origin) return json({ error: "invalid origin" }, 403);
  const browser = request.cookies.get(FEEDBACK_COOKIE)?.value;
  if (!validBrowser(browser)) return json({ error: "reload feedback" }, 403);
  let body;
  try { body = await boundedBody(request); } catch { return json({ error: "invalid request" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "invalid request" }, 400);
  const vote = body as Record<string, unknown>;
  const target = await validFeedbackTarget(vote);
  if (!target || !validFeedbackVote(vote.answer, vote.reason)) return json({ error: "invalid vote" }, 400);
  if (!verifyFeedbackSignature(config.secret, browser, target, request.headers.get("x-feedback-token") ?? "")) return json({ error: "reload feedback" }, 403);
  try {
    const result = await saveFeedback(config, browser, target, vote.answer, vote.reason as FeedbackReason | undefined);
    if (result.limited) return json({ error: "try later" }, 429);
    return json({ available: true, counts: result.counts, voted: true, duplicate: result.duplicate });
  } catch { return json({ error: "temporarily unavailable" }, 503); }
}
