import type { Metric } from "./types";

// 政令市の区など、待機児童が「区別非公表」（市単位でのみ公表）の自治体は
// source に「区別非公表（◯◯市全体で N人）」を含める。value は誤読防止のため 0。
// 数値表示の代わりに「データなし」＋市計の注記を出すための判定。
export function isWaitlistDisclosed(m: Metric): boolean {
  return !String(m.source ?? "").includes("区別非公表");
}
