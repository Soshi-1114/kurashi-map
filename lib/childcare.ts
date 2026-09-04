// 保育所等の受け入れ状況（childcare）の対象判定・派生値ヘルパー。
// 出典: こども家庭庁「保育所等関連状況取りまとめ」別添「（参考）定員・申込者の状況」。
// waitlist.ts / vacancy.ts と同じく、判定を UI 側で再実装せずここに集約する。

import type { Municipality } from "./types";

type Childcare = NonNullable<Municipality["childcare"]>;

/** childcare データが収録されているか（未収録の自治体は undefined）。 */
export function hasChildcareData(c: Municipality["childcare"]): c is Childcare {
  return c != null;
}

/**
 * 保育所等の定員があるか（capacity=0 は「保育所等の定員なし」の小規模町村）。
 * hasChildcareData で絞った後の else 分岐が never にならないよう、型述語にはしない。
 */
export function hasChildcareCapacity(c: Municipality["childcare"]): boolean {
  return c != null && c.capacity > 0;
}

/**
 * 定員余裕率（%）=（定員 − 利用児童数）÷ 定員 × 100。
 * 負値は定員の弾力運用（定員超過受け入れ）を示す実データで、そのまま返す。
 * 定員 0 は算出不能のため null。
 */
export function childcareOpenRatioPct(c: Municipality["childcare"]): number | null {
  if (!hasChildcareData(c) || c.capacity <= 0) return null;
  return ((c.capacity - c.enrolled) / c.capacity) * 100;
}

/** 定員の空き数（定員 − 利用児童数。負値=定員超過受け入れ）。定員 0 は null。 */
export function childcareOpenSlots(c: Municipality["childcare"]): number | null {
  if (!hasChildcareData(c) || c.capacity <= 0) return null;
  return c.capacity - c.enrolled;
}

/** 年齢別の定員余裕率（%）。0歳児（保活の主戦場）と1,2歳児を個別に見る。 */
export function childcareOpenRatioAge0Pct(c: Municipality["childcare"]): number | null {
  if (!hasChildcareData(c) || c.capacityAge0 <= 0) return null;
  return ((c.capacityAge0 - c.enrolledAge0) / c.capacityAge0) * 100;
}
export function childcareOpenRatioAge12Pct(c: Municipality["childcare"]): number | null {
  if (!hasChildcareData(c) || c.capacityAge12 <= 0) return null;
  return ((c.capacityAge12 - c.enrolledAge12) / c.capacityAge12) * 100;
}

/** 政令市の区に市全体の値を持たせているか（source のセンチネルで判定）。 */
export function isChildcareCityAggregate(source: string): boolean {
  return source.includes("市全体");
}

/** 余裕率の表示テキスト（例 "16.7%"、負値は "-3.2%"）。 */
export function childcareOpenRatioText(c: Municipality["childcare"]): string {
  const r = childcareOpenRatioPct(c);
  return r == null ? "—" : `${r.toFixed(1)}%`;
}
