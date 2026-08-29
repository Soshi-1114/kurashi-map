// 街診断（/shindan）のドメインロジック。
//
// 独自スコアは作らず、確立済みの住みやすさ5軸（lib/livabilityScore.ts。実データのみ・
// 治安除外・しきい値は契約面）に将来性（IPSS 2050年推計）を加えた6軸を「質問＝軸の
// 重み付け」で合成する。honesty 方針: 重視した軸のデータが無い自治体は結果から除外し
// （欠損を0点扱いにも満点扱いにもしない）、UI にその旨を明示する。
//
// サーバー（SSGビルド）が全自治体の軸スコアを ShindanEntry に前計算し、クライアントは
// 重み付き平均の並べ替えだけを行う（フル Municipality をクライアントに配らない）。

import type { Municipality } from "./types";
import { computeLivability, type AxisKey } from "./livabilityScore";
import { futureChangeRate2050 } from "./futurePopulation";
import { REGIONS } from "./prefs";

export type ShindanAxisKey = AxisKey | "future";

/** 質問（＝軸）の定義。表示順は質問の自然な流れで固定。 */
export const SHINDAN_AXES: ReadonlyArray<{
  key: ShindanAxisKey;
  label: string;
  question: string;
  /** 軸の中身の説明（何の実データで測るか。誤解防止のため質問の直下に出す） */
  basis: string;
}> = [
  { key: "rent", label: "家賃", question: "住まいのコストを抑えたい", basis: "民営借家の家賃平均（住宅・土地統計調査）" },
  { key: "access", label: "アクセス", question: "電車での移動・通勤を重視する", basis: "自治体内の駅数（国土数値情報）" },
  { key: "childcare", label: "子育て", question: "保育園の入りやすさを重視する", basis: "待機児童数（こども家庭庁）" },
  { key: "disaster", label: "災害", question: "災害リスクの低さを重視する", basis: "浸水・土砂・津波・高潮・液状化の区域評価（区域内最大区分）" },
  { key: "infrastructure", label: "生活インフラ", question: "医療・保育施設の多さを重視する", basis: "医療機関数・保育/幼稚園数（実数のため大きな街ほど高評価）" },
  { key: "future", label: "将来性", question: "将来も人口を維持する見込みを重視する", basis: "2050年推計人口の増減率（IPSS 令和5年推計・公的推計）" },
];

/** 重み: 0=こだわらない / 1=やや重視 / 2=とても重視。 */
export type ShindanWeight = 0 | 1 | 2;
export type ShindanWeights = Record<ShindanAxisKey, ShindanWeight>;

export const EMPTY_WEIGHTS: ShindanWeights = {
  rent: 0, access: 0, childcare: 0, disaster: 0, infrastructure: 0, future: 0,
};

/** クライアントへ配る1自治体分（軸スコアの前計算済み・軽量射影）。 */
export type ShindanEntry = {
  code: string;
  name: string;
  pref: string;
  /**
   * SHINDAN_AXES と同順の星（1..5）を1文字ずつ並べた文字列。0=データなし。
   * 例 "453120"。数値配列より配信ペイロードが小さい。
   */
  s: string;
};

// 将来性の星: 2050年推計人口の増減率（2020年比%）を5段階へ。しきい値は地図
// （FUTURE_CHANGE_THRESHOLDS: -50/-30/-10/0）と同じ発想で「0以上=増加」を最上位に置く。
// データなし（浜通り13市町村・北方領土等）は null。
function futureStar(m: Municipality): number | null {
  const r = futureChangeRate2050(m.futurePopulation);
  if (r == null) return null;
  return r >= 0 ? 5 : r >= -10 ? 4 : r >= -25 ? 3 : r >= -40 ? 2 : 1;
}

/** サーバー側: 全自治体の軸スコアを前計算する（ランキングと同じ market-level 前提で呼ぶ）。 */
export function buildShindanEntries(munis: Municipality[]): ShindanEntry[] {
  return munis.map((m) => {
    const liv = computeLivability(m);
    const byKey = new Map(liv.axes.map((a) => [a.key as ShindanAxisKey, a.stars]));
    byKey.set("future", futureStar(m));
    const s = SHINDAN_AXES.map((axis) => String(byKey.get(axis.key) ?? 0)).join("");
    return { code: m.code, name: m.displayName ?? m.name, pref: m.pref, s };
  });
}

export type ShindanResult = {
  entry: ShindanEntry;
  /** 適合スコア（0..100。重み付き平均の星を20倍） */
  score: number;
  /** 重視した軸の星（表示用。SHINDAN_AXES の並び順で、重み0の軸は含まない） */
  axisStars: { key: ShindanAxisKey; label: string; stars: number; weight: ShindanWeight }[];
};

/** 重みが1つ以上あるか（無ければ診断結果は出さない）。 */
export function hasAnyWeight(w: ShindanWeights): boolean {
  return SHINDAN_AXES.some((a) => w[a.key] > 0);
}

/**
 * 診断本体: 重み付き平均（星1..5）で並べ替えてトップ N を返す。
 * - 重視した（weight>0）軸のデータが無い自治体は除外（欠損を点数化しない）
 * - 地方が選ばれていれば団体コード先頭2桁で絞り込む（空 = 全国）
 * - 同点は団体コード順（北→南）で安定化
 */
export function runShindan(
  entries: ShindanEntry[],
  weights: ShindanWeights,
  regionKeys: string[],
  limit = 10,
): { results: ShindanResult[]; eligibleCount: number } {
  if (!hasAnyWeight(weights)) return { results: [], eligibleCount: 0 };

  const prefixes =
    regionKeys.length > 0
      ? new Set(REGIONS.filter((r) => regionKeys.includes(r.key)).flatMap((r) => r.prefixes))
      : null;

  const weighted = SHINDAN_AXES.map((a, i) => ({ ...a, i, weight: weights[a.key] })).filter(
    (a) => a.weight > 0,
  );

  const scored: ShindanResult[] = [];
  for (const entry of entries) {
    if (prefixes && !prefixes.has(entry.code.slice(0, 2))) continue;
    let sum = 0;
    let wsum = 0;
    const axisStars: ShindanResult["axisStars"] = [];
    let missing = false;
    for (const a of weighted) {
      const stars = Number(entry.s[a.i]);
      if (stars === 0) { missing = true; break; } // 重視軸のデータなし → 除外
      sum += stars * a.weight;
      wsum += a.weight;
      axisStars.push({ key: a.key, label: a.label, stars, weight: a.weight });
    }
    if (missing) continue;
    scored.push({ entry, score: Math.round((sum / wsum) * 20), axisStars });
  }

  scored.sort((x, y) => y.score - x.score || (x.entry.code < y.entry.code ? -1 : 1));
  return { results: scored.slice(0, limit), eligibleCount: scored.length };
}

// ---- URL 同期（?w=210120&r=kanto,tokai。診断結果を共有・ブックマーク可能にする） ----

/** 重みを SHINDAN_AXES 順の6桁文字列へ（例 "210120"）。 */
export function encodeWeights(w: ShindanWeights): string {
  return SHINDAN_AXES.map((a) => String(w[a.key])).join("");
}

/** 6桁文字列から重みを復元。不正・欠落は EMPTY_WEIGHTS（各桁は 0..2 のみ許容）。 */
export function decodeWeights(raw: string | null): ShindanWeights {
  if (!raw || !new RegExp(`^[0-2]{${SHINDAN_AXES.length}}$`).test(raw)) return { ...EMPTY_WEIGHTS };
  const out = { ...EMPTY_WEIGHTS };
  SHINDAN_AXES.forEach((a, i) => {
    out[a.key] = Number(raw[i]) as ShindanWeight;
  });
  return out;
}

/** 地方キーの検証つき復元（未知キーは落とす）。 */
export function decodeRegions(raw: string | null): string[] {
  if (!raw) return [];
  const known = new Set(REGIONS.map((r) => r.key));
  return raw.split(",").filter((k) => known.has(k));
}
