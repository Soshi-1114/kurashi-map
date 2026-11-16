import { createHmac, timingSafeEqual } from "node:crypto";
import { FEEDBACK_REASONS, FEEDBACK_VERSION, type FeedbackTarget, type FeedbackCounts, type FeedbackAnswer, type FeedbackReason } from "./contentFeedback";
import { getRankingBySlug } from "./rankings";
import { PREFS, REGIONS } from "./prefs";
import { getMunicipality } from "./metrics";

export const FEEDBACK_COOKIE = "kurashimap_feedback";
const TTL = 365 * 24 * 60 * 60;

export async function validFeedbackTarget(value: unknown): Promise<FeedbackTarget | null> {
  if (!value || typeof value !== "object") return null;
  const { page, section, version } = value as Record<string, unknown>;
  if (version !== FEEDBACK_VERSION || typeof page !== "string" || page.length > 130) return null;
  const parts = page.split(":");
  if (parts[0] === "ranking" && section === "ranking" && getRankingBySlug(parts[1])) {
    if (parts.length === 2 || (parts.length === 4 && ((parts[2] === "pref" && PREFS.some(p => p.slug === parts[3])) || (parts[2] === "region" && REGIONS.some(r => r.key === parts[3]))))) {
      return { page, section, version };
    }
  }
  if (parts[0] === "area" && section === "overview" && parts.length === 3 && /^\d{5}$/.test(parts[2]) && PREFS.some(p => p.slug === parts[1] && p.codePrefix === parts[2].slice(0, 2))) {
    const muni = await getMunicipality(parts[2]);
    if (muni?.pref === parts[1]) return { page, section, version };
  }
  return null;
}

export function feedbackConfig() {
  const url = process.env.FEEDBACK_REDIS_REST_URL;
  const token = process.env.FEEDBACK_REDIS_REST_TOKEN;
  const secret = process.env.FEEDBACK_SIGNING_SECRET;
  if (process.env.FEEDBACK_ENABLED !== "true" || !url || !token || !secret || secret.length < 32) return null;
  try { if (new URL(url).protocol !== "https:") return null; } catch { return null; }
  return { url: url.replace(/\/$/, ""), token, secret };
}

export function feedbackSignature(secret: string, browser: string, target: FeedbackTarget): string {
  return createHmac("sha256", secret).update(JSON.stringify([browser, target.page, target.section, target.version])).digest("hex");
}

export function verifyFeedbackSignature(secret: string, browser: string, target: FeedbackTarget, provided: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(provided)) return false;
  return timingSafeEqual(Buffer.from(feedbackSignature(secret, browser, target)), Buffer.from(provided));
}

export function validFeedbackVote(answer: unknown, reason: unknown): answer is FeedbackAnswer {
  return (answer === "yes" || answer === "no") && (reason == null || (answer === "no" && FEEDBACK_REASONS.some(r => r.value === reason)));
}

/** 同じブラウザー・対象・版の重複判定と集計を1トランザクションで処理する。 */
export const VOTE_SCRIPT = `
local yes = tonumber(redis.call('HGET', KEYS[1], 'yes') or '0')
local no = tonumber(redis.call('HGET', KEYS[1], 'no') or '0')
if redis.call('EXISTS', KEYS[2]) == 1 then return {2, yes, no} end
local rate = redis.call('INCR', KEYS[3])
if rate == 1 then redis.call('EXPIRE', KEYS[3], 60) end
if rate > 10 then return {3, yes, no} end
redis.call('SET', KEYS[2], ARGV[1], 'EX', ARGV[3])
redis.call('HINCRBY', KEYS[1], ARGV[1], 1)
if ARGV[1] == 'no' and ARGV[2] ~= '' then redis.call('HINCRBY', KEYS[1], 'reason:' .. ARGV[2], 1) end
redis.call('EXPIRE', KEYS[1], ARGV[3])
return {1, tonumber(redis.call('HGET', KEYS[1], 'yes') or '0'), tonumber(redis.call('HGET', KEYS[1], 'no') or '0')}
`;

type Config = NonNullable<ReturnType<typeof feedbackConfig>>;
function keys(config: Config, browser: string, target: FeedbackTarget) {
  const hash = (value: string) => createHmac("sha256", config.secret).update(value).digest("hex");
  const page = hash(JSON.stringify(target));
  // 共通hash tagでRedis ClusterでもLuaのキーを同一slotへ置く。
  return { counts: `feedback:{content}:${page}`, vote: `feedback:{content}:${page}:${hash(browser)}`, rate: `feedback:{content}:rate:${hash(browser)}` };
}

async function command(config: Config, args: (string | number)[]): Promise<unknown> {
  const response = await fetch(config.url, { method: "POST", headers: { authorization: `Bearer ${config.token}`, "content-type": "application/json" }, body: JSON.stringify(args), cache: "no-store", signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error("Feedback storage unavailable");
  const data = await response.json();
  if (data.error || !("result" in data)) throw new Error("Feedback storage unavailable");
  return data.result;
}

function count(value: unknown): number {
  if (value == null) return 0;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0) throw new Error("Invalid feedback count");
  return n;
}

export async function readFeedback(config: Config, browser: string, target: FeedbackTarget): Promise<{ counts: FeedbackCounts; voted: boolean }> {
  const k = keys(config, browser, target);
  const [raw, voted] = await Promise.all([command(config, ["HMGET", k.counts, "yes", "no"]), command(config, ["EXISTS", k.vote])]);
  if (!Array.isArray(raw) || raw.length !== 2) throw new Error("Invalid feedback response");
  return { counts: { yes: count(raw[0]), no: count(raw[1]) }, voted: Number(voted) === 1 };
}

export async function saveFeedback(config: Config, browser: string, target: FeedbackTarget, answer: FeedbackAnswer, reason?: FeedbackReason) {
  const k = keys(config, browser, target);
  const result = await command(config, ["EVAL", VOTE_SCRIPT, 3, k.counts, k.vote, k.rate, answer, reason ?? "", TTL]);
  if (!Array.isArray(result) || result.length !== 3 || ![1, 2, 3].includes(Number(result[0]))) throw new Error("Invalid feedback response");
  return { limited: Number(result[0]) === 3, duplicate: Number(result[0]) === 2, counts: { yes: count(result[1]), no: count(result[2]) } };
}

/** 管理用CLIからのみ利用。匿名識別子を出力せず、改善理由の集計を取得する。 */
export async function feedbackReport(config: Config, target: FeedbackTarget) {
  const fields = ["yes", "no", ...FEEDBACK_REASONS.map(r => `reason:${r.value}`)];
  const raw = await command(config, ["HMGET", keys(config, "", target).counts, ...fields]);
  if (!Array.isArray(raw) || raw.length !== fields.length) throw new Error("Invalid feedback report");
  return Object.fromEntries(fields.map((field, i) => [field, count(raw[i])]));
}
