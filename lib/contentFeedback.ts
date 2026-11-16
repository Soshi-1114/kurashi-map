export const FEEDBACK_VERSION = "2026-11-16-v1";
export const FEEDBACK_REASONS = [
  { value: "missing", label: "探している情報がなかった" },
  { value: "unclear", label: "数字の意味が分かりにくかった" },
  { value: "outdated", label: "情報の時点が古かった" },
  { value: "usability", label: "操作が分かりにくかった" },
] as const;
export type FeedbackReason = typeof FEEDBACK_REASONS[number]["value"];
export type FeedbackSection = "ranking" | "overview";
export type FeedbackAnswer = "yes" | "no";
export type FeedbackTarget = { page: string; section: FeedbackSection; version: string };
export type FeedbackCounts = { yes: number; no: number };
