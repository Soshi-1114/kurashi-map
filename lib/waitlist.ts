import type { Metric, Municipality } from "./types";

// 政令市の区など、待機児童が「区別非公表」（市単位でのみ公表）の自治体は
// source に「区別非公表（◯◯市全体で N人）」を含める。value は誤読防止のため 0。
// 数値表示の代わりに「データなし」＋市計の注記を出すための判定。
export function isWaitlistDisclosed(m: Metric): boolean {
  return !String(m.source ?? "").includes("区別非公表");
}

/** 集合のうち待機児童数が公表されている自治体数（県別ランキングの「データ概況」用の集計）。 */
export function countWaitlistDisclosed(munis: Municipality[]): number {
  return munis.filter((m) => isWaitlistDisclosed(m.waitlistChildren)).length;
}
