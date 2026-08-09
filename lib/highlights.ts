// 「この自治体の特徴」の決定論的抽出ロジック（LLM 不使用）。
// 全国平均・都道府県平均との差、全国順位のパーセンタイルから「目立つ指標」を
// スコア化し、しきい値を超えたものだけを最大5件返す。
//
// honesty 方針: 値の良し悪しは評価しない。文面は「全国平均より◯ポイント高い」の
// ような客観表現に限定する。欠損（センチネル）指標は候補から外し、推計はしない。
// 平均との差が小さい指標は「同水準」等のノイズ文を作らず、単に採用しない。
// 3件未満のときは常に存在する順位事実（人口の全国/県内順位・家賃の県平均対比）で
// 補完する。それも無い自治体（北方領土等）は 0 件になり、UI 側で節ごと非表示にする。

import type { Municipality } from "./types";
import type { AreaStats } from "./areaStats";
import type { ForeignComparison } from "./foreignStats";
import type { RankPos } from "./rankingStats";
import type { PrefRanks } from "./prefRanks";
import { hasRent } from "./rentColor";
import { hasLandPrice } from "./landPrice";
import { hasVacancy } from "./vacancy";
import { isWaitlistDisclosed } from "./waitlist";
import { formatAsOfJa } from "./rankings";
import { populationDensity, densityText } from "./populationDensity";
import { signedPct } from "./format";

export type HighlightKind = "deviation" | "rank" | "membership";

export type Highlight = {
  /** 安定キー（テスト・重複排除用） */
  key: string;
  /** ラベルチップ（指標名） */
  label: string;
  /** 本文（中立・客観表現のみ） */
  text: string;
  /** 抽出スコア（0〜1.5）。バックフィルは 0。 */
  score: number;
  kind: HighlightKind;
};

export type HighlightsCtx = {
  areaStats: AreaStats;
  /** getForeignStats().get(code)。対象外・人口不明の自治体は null。 */
  foreign: ForeignComparison | null;
  /** getRankPositions()（全国順位。行政区は含まれない）。 */
  rankPositions: Map<string, Map<string, RankPos>>;
  /** getPrefRanks()（県内順位。行政区は含まれない）。 */
  prefRanks: PrefRanks;
  prefName: string;
};

/** 採用しきい値・スコア正規化の定数（マジックナンバー回避）。 */
export const HIGHLIGHT_THRESHOLDS = {
  /** 家賃: 全国平均との相対差がこれ以上で採用 */
  rentPct: 0.15,
  /** 地価: 同上 */
  landPricePct: 0.2,
  /** 人口増減率: 全国平均とのポイント差（%pt） */
  popChangePt: 2.0,
  /** 空き家率: ポイント差（%pt） */
  vacancyPt: 5.0,
  /** 外国人比率: ポイント差（%pt） */
  foreignPt: 1.0,
  /** 人口密度: 上位/下位このパーセンタイル以内で採用 */
  densityPctile: 0.05,
  /** 人口: 上位このパーセンタイル以内で採用 */
  populationPctile: 0.02,
} as const;

const SCORE_CAP = 1.5;
const MAX_ITEMS = 5;
const MIN_ITEMS = 3;

// 同点時の優先順（ユーザーにとって理解しやすい指標を先に）。
const PRIORITY: string[] = [
  "rent",
  "landPrice",
  "populationChangeRate",
  "density",
  "vacancy",
  "foreignRatio",
  "population",
  "waitlistZero",
];

const yen = (v: number) => v.toLocaleString();

/** 全国順位の補足句。順位表に code が無い（行政区等）場合は空文字。 */
function rankSuffix(
  rankPositions: Map<string, Map<string, RankPos>>,
  slug: string,
  code: string,
  directionLabel: string,
): string {
  const pos = rankPositions.get(slug)?.get(code);
  if (!pos) return "";
  return `（${directionLabel}で全国${pos.rank.toLocaleString()}位／${pos.total.toLocaleString()}自治体中）`;
}

/** 「この自治体の特徴」を決定論的に抽出する（最大5件・0件もあり得る）。 */
export function buildHighlights(m: Municipality, ctx: HighlightsCtx): Highlight[] {
  const t = HIGHLIGHT_THRESHOLDS;
  const candidates: Highlight[] = [];

  // --- 偏差系（全国平均との差） ---

  // 家賃（%差）
  const rentNat = ctx.areaStats.rent.national;
  if (hasRent(m.rent.value) && rentNat != null && rentNat > 0) {
    const ratio = Math.abs(m.rent.value - rentNat) / rentNat;
    if (ratio >= t.rentPct) {
      const below = m.rent.value < rentNat;
      const pct = Math.round(ratio * 100);
      const suffix = rankSuffix(
        ctx.rankPositions,
        below ? "rent-cheap" : "rent-high",
        m.code,
        below ? "安い順" : "高い順",
      );
      candidates.push({
        key: "rent",
        label: "家賃",
        kind: "deviation",
        score: Math.min(ratio, SCORE_CAP),
        text: `家賃中央値は${yen(m.rent.value)}円/月で、全国平均（${yen(rentNat)}円）より${pct}%${below ? "低い" : "高い"}水準${suffix}`,
      });
    }
  }

  // 地価（%差）
  const landNat = ctx.areaStats.landPrice.national;
  if (hasLandPrice(m.landPrice.value) && landNat != null && landNat > 0) {
    const ratio = Math.abs(m.landPrice.value - landNat) / landNat;
    if (ratio >= t.landPricePct) {
      const below = m.landPrice.value < landNat;
      const pct = Math.round(ratio * 100);
      const suffix = rankSuffix(
        ctx.rankPositions,
        below ? "land-price-low" : "land-price-high",
        m.code,
        below ? "安い順" : "高い順",
      );
      candidates.push({
        key: "landPrice",
        label: "地価",
        kind: "deviation",
        score: Math.min(ratio, SCORE_CAP),
        text: `住宅地の地価は${yen(m.landPrice.value)}円/㎡で、全国平均（${yen(landNat)}円）より${pct}%${below ? "低い" : "高い"}水準${suffix}`,
      });
    }
  }

  // 人口増減率（ポイント差）
  const changeNat = ctx.areaStats.populationChangeRate.national;
  if (typeof m.populationChangeRate === "number" && m.population > 0 && changeNat != null) {
    const diff = m.populationChangeRate - changeNat;
    if (Math.abs(diff) >= t.popChangePt) {
      const above = diff > 0;
      const suffix = rankSuffix(
        ctx.rankPositions,
        above ? "population-growth" : "population-decline",
        m.code,
        above ? "増加率の高い順" : "減少率の大きい順",
      );
      candidates.push({
        key: "populationChangeRate",
        label: "人口増減",
        kind: "deviation",
        score: Math.min(Math.abs(diff) / 5, SCORE_CAP),
        text: `2020→2025年の人口増減率は${signedPct(m.populationChangeRate)}%で、全国平均（${signedPct(changeNat)}%）より${Math.abs(diff).toFixed(1)}ポイント${above ? "高い" : "低い"}${suffix}`,
      });
    }
  }

  // 空き家率（ポイント差）
  const vacNat = ctx.areaStats.vacancyRate.national;
  if (hasVacancy(m.vacancy) && vacNat != null) {
    const diff = m.vacancy.rate - vacNat;
    if (Math.abs(diff) >= t.vacancyPt) {
      const above = diff > 0;
      const suffix = rankSuffix(
        ctx.rankPositions,
        above ? "vacancy-high" : "vacancy-low",
        m.code,
        above ? "高い順" : "低い順",
      );
      candidates.push({
        key: "vacancy",
        label: "空き家率",
        kind: "deviation",
        score: Math.min(Math.abs(diff) / 10, SCORE_CAP),
        text: `空き家率は${m.vacancy.rate.toFixed(1)}%で、全国平均（${vacNat.toFixed(1)}%）より${Math.abs(diff).toFixed(1)}ポイント${above ? "高い" : "低い"}${suffix}`,
      });
    }
  }

  // 外国人住民比率（ポイント差。平均は foreignStats の加重平均を使用）
  if (ctx.foreign) {
    const fc = ctx.foreign;
    const diff = fc.ratio - fc.nationalAvg;
    if (Math.abs(diff) >= t.foreignPt) {
      const above = diff > 0;
      const suffix = rankSuffix(
        ctx.rankPositions,
        above ? "foreign-ratio-high" : "foreign-ratio-low",
        m.code,
        above ? "高い順" : "低い順",
      );
      candidates.push({
        key: "foreignRatio",
        label: "外国人比率",
        kind: "deviation",
        score: Math.min(Math.abs(diff) / 3, SCORE_CAP),
        text: `外国人住民の割合は${fc.ratio.toFixed(2)}%で、全国平均（${fc.nationalAvg.toFixed(2)}%）より${Math.abs(diff).toFixed(1)}ポイント${above ? "高い" : "低い"}${suffix}`,
      });
    }
  }

  // --- 順位系（全国順位のパーセンタイル） ---

  // 人口密度（上位/下位5%）
  const density = populationDensity(m);
  const densPos = ctx.rankPositions.get("population-density")?.get(m.code);
  if (density != null && densPos && densPos.total > 1) {
    const p = (densPos.rank - 1) / (densPos.total - 1);
    if (p <= t.densityPctile) {
      candidates.push({
        key: "density",
        label: "人口密度",
        kind: "rank",
        score: 1 - p / t.densityPctile,
        text: `人口密度は約${densityText(density)}で、全国${densPos.rank.toLocaleString()}位（${densPos.total.toLocaleString()}自治体中）`,
      });
    } else if (p >= 1 - t.densityPctile) {
      const lowPos = ctx.rankPositions.get("population-density-low")?.get(m.code);
      if (lowPos) {
        candidates.push({
          key: "density",
          label: "人口密度",
          kind: "rank",
          score: 1 - (1 - p) / t.densityPctile,
          text: `人口密度は約${densityText(density)}で、低い順で全国${lowPos.rank.toLocaleString()}位（${lowPos.total.toLocaleString()}自治体中）`,
        });
      }
    }
  }

  // 人口（上位2%のみ）
  const popPos = ctx.rankPositions.get("population-most")?.get(m.code);
  if (popPos && popPos.total > 1 && m.population > 0) {
    const p = (popPos.rank - 1) / (popPos.total - 1);
    if (p <= t.populationPctile) {
      candidates.push({
        key: "population",
        label: "人口",
        kind: "rank",
        score: 1 - p / t.populationPctile,
        text: `人口は${m.population.toLocaleString()}人で、全国${popPos.rank.toLocaleString()}位（${popPos.total.toLocaleString()}市区町村中）`,
      });
    }
  }

  // --- 該当系 ---

  // 待機児童ゼロ（公表値がある自治体のみ）
  if (isWaitlistDisclosed(m.waitlistChildren) && m.waitlistChildren.value === 0) {
    candidates.push({
      key: "waitlistZero",
      label: "待機児童",
      kind: "membership",
      score: 0.5,
      text: `待機児童は0人（${formatAsOfJa(m.waitlistChildren.asOf)}時点、こども家庭庁公表値）`,
    });
  }

  // スコア降順 → 固定優先順 → key 辞書順で安定ソートし、上位5件。
  const sorted = candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const pa = PRIORITY.indexOf(a.key);
    const pb = PRIORITY.indexOf(b.key);
    if (pa !== pb) return pa - pb;
    return a.key < b.key ? -1 : 1;
  });
  const picked = sorted.slice(0, MAX_ITEMS);

  // 3件未満なら順位事実でバックフィル（「同水準」等のノイズ文は作らない）。
  if (picked.length < MIN_ITEMS) {
    const has = (key: string) => picked.some((h) => h.key === key);

    // ① 人口の全国順位＋県内順位（行政区は順位表に無いためスキップされる）
    const prefPop = ctx.prefRanks.get("population-most")?.get(m.code);
    if (!has("population") && popPos && m.population > 0) {
      const prefPart = prefPop ? `・${ctx.prefName}内${prefPop.rank.toLocaleString()}位` : "";
      picked.push({
        key: "population",
        label: "人口",
        kind: "rank",
        score: 0,
        text: `人口は${m.population.toLocaleString()}人で、全国${popPos.rank.toLocaleString()}位（${popPos.total.toLocaleString()}市区町村中）${prefPart}`,
      });
    }

    // ② 家賃の県平均対比（偏差採用済みならスキップ）
    const prefRent = ctx.areaStats.rent.byPref.get(m.pref);
    if (picked.length < MIN_ITEMS && !has("rent") && hasRent(m.rent.value) && prefRent != null) {
      picked.push({
        key: "rentPref",
        label: "家賃",
        kind: "deviation",
        score: 0,
        text: `家賃中央値は${yen(m.rent.value)}円/月（${ctx.prefName}平均は${yen(prefRent)}円）`,
      });
    }
  }

  return picked;
}
