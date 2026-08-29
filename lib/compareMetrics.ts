// 自治体比較ページ（/compare）の行定義。フル Municipality から表示文字列を作る
// 純関数の集まりで、サーバー/クライアント両方から使える。
//
// honesty 方針: 欠損はセンチネル判定ヘルパー（hasRent / hasVacancy / hasShelterData 等）で
// 判定し、「データなし」「対象外」「非公表」「未収録」を値と区別して表示する。
// NaN / undefined がそのまま画面に出る経路を作らない。

import type { Municipality } from "./types";
import { hasRent } from "./rentColor";
import { hasLandPrice } from "./landPrice";
import { hasVacancy } from "./vacancy";
import { isWaitlistDisclosed } from "./waitlist";
import { hasForeignData, foreignRatioPct } from "./foreignResidents";
import { isAmenitiesCounted, isHazardEvaluated } from "./coverage";
import { hasShelterData } from "./shelters";
import { populationDensity, densityText } from "./populationDensity";
import { hasFiscal } from "./fiscal";
import { signedPct } from "./format";
import {
  floodGraded,
  floodLevelLabel,
  floodLevelOf,
  landslideLevelLabel,
  landslideLevelOf,
  coastalHazardLabel,
  tsunamiLevelOf,
  stormSurgeLevelOf,
  liquefactionLabel,
  liquefactionLevelOf,
} from "./hazardScale";

export type CompareGroup = "基本" | "住まい" | "子育て・生活" | "災害リスク";

// 全国平均（参考）列に使う値。areaStats/foreignStats から呼び出し側（サーバー）が
// 組み立てて渡す（このモジュールは areaStats/foreignStats を直接 import しない —
// クライアントに渡すのは集計済みの数値のみで、集計ロジック自体は持ち込まない）。
export type NationalAverages = {
  rent: number | null;
  landPrice: number | null;
  populationChangeRate: number | null;
  vacancyRate: number | null;
  density: number | null;
  foreignRatio: number | null;
  /** 財政力指数の全国平均（特別区除外。areaStats.fiscalIndex）。 */
  fiscalIndex: number | null;
};

export type CompareRowDef = {
  key: string;
  label: string;
  group: CompareGroup;
  /** 表示文字列（欠損は「データなし／対象外／非公表／未収録」等を返す） */
  value: (m: Municipality) => string;
  /** 全国平均（参考）列の表示文字列。母集団の意味が異なる/存在しない指標は省略する */
  nationalAvgText?: (n: NationalAverages) => string;
  /**
   * 簡易バー表示用の生値。非負の数値指標のみ定義する（負値を取りうる人口増減率・
   * 順序尺度の災害リスクは対象外）。value() と同じセンチネル判定で欠損は null を返す。
   */
  numericValue?: (m: Municipality) => number | null;
  /** 全国平均（参考）列のバー用の生値。numericValue と対になる指標のみ定義する。 */
  nationalAvgValue?: (n: NationalAverages) => number | null;
};

const NO_VALUE = "—";

function changeRateText(m: Municipality): string {
  if (typeof m.populationChangeRate !== "number" || !(m.population > 0)) return NO_VALUE;
  return `${signedPct(m.populationChangeRate)}%`;
}

function floodText(m: Municipality): string {
  if (!isHazardEvaluated(m.hazard.source)) return "対象外";
  if (floodGraded(m.hazard)) return floodLevelLabel(floodLevelOf(m.hazard));
  return m.hazard.hasFloodRisk ? "想定あり" : "想定なし";
}

/**
 * 数値指標行のビルダー。value()（表示文字列）と numericValue()（バー用の生値）が
 * 同じ欠損判定からズレないよう、raw() 1箇所だけに判定を書けば両方が導出される
 * （どちらかだけセンチネル対応を直して片方を直し忘れる、という事故を防ぐ）。
 * nationalAvg も同様に raw 1つから text/value を両方導出し、
 * 「テキストはあるのにバー値がない／その逆」という不整合が起きない形にする。
 */
function numericRow(opts: {
  key: string;
  label: string;
  group: CompareGroup;
  raw: (m: Municipality) => number | null;
  format: (v: number) => string;
  fallback?: string;
  nationalAvg?: { raw: (n: NationalAverages) => number | null; format?: (v: number) => string };
}): CompareRowDef {
  const fallback = opts.fallback ?? NO_VALUE;
  const avgFormat = opts.nationalAvg?.format ?? opts.format;
  return {
    key: opts.key,
    label: opts.label,
    group: opts.group,
    value: (m) => {
      const v = opts.raw(m);
      return v != null ? opts.format(v) : fallback;
    },
    numericValue: opts.raw,
    ...(opts.nationalAvg
      ? {
          nationalAvgText: (n: NationalAverages) => {
            const v = opts.nationalAvg!.raw(n);
            return v != null ? avgFormat(v) : NO_VALUE;
          },
          nationalAvgValue: opts.nationalAvg.raw,
        }
      : {}),
  };
}

export const COMPARE_ROWS: CompareRowDef[] = [
  // ---- 基本 ----
  numericRow({
    key: "population",
    label: "人口",
    group: "基本",
    raw: (m) => (m.population > 0 ? m.population : null),
    format: (v) => `${v.toLocaleString()}人`,
  }),
  {
    key: "populationChangeRate",
    label: "人口増減率（2020→2025）",
    group: "基本",
    value: changeRateText,
    nationalAvgText: (n) => (n.populationChangeRate != null ? `${signedPct(n.populationChangeRate)}%` : NO_VALUE),
    // 負値を取りうるためバー表示の対象外（テキスト＝符号付き%のみで表現する）。
  },
  numericRow({
    key: "density",
    label: "人口密度",
    group: "基本",
    raw: (m) => populationDensity(m),
    format: densityText,
    nationalAvg: { raw: (n) => n.density },
  }),
  numericRow({
    key: "area",
    label: "面積",
    group: "基本",
    raw: (m) => (m.areaKm2 != null && m.areaKm2 > 0 ? m.areaKm2 : null),
    format: (v) => `${v.toLocaleString()}km²`,
  }),
  numericRow({
    key: "fiscalIndex",
    label: "財政力指数",
    group: "基本",
    raw: (m) => (hasFiscal(m.fiscal) ? m.fiscal.index : null),
    format: (v) => v.toFixed(2),
    fallback: "対象外",
    nationalAvg: { raw: (n) => n.fiscalIndex },
  }),
  numericRow({
    key: "foreignRatio",
    label: "外国人住民比率",
    group: "基本",
    raw: (m) => (hasForeignData(m.foreignResidents.source) && m.population > 0 ? foreignRatioPct(m) : null),
    format: (v) => `${v.toFixed(2)}%`,
    fallback: "対象外",
    nationalAvg: { raw: (n) => n.foreignRatio },
  }),
  // ---- 住まい ----
  numericRow({
    key: "rent",
    label: "家賃平均（民営借家）",
    group: "住まい",
    raw: (m) => (hasRent(m.rent.value) ? m.rent.value : null),
    format: (v) => `${v.toLocaleString()}円/月`,
    fallback: "データなし",
    nationalAvg: { raw: (n) => n.rent },
  }),
  numericRow({
    key: "landPrice",
    label: "地価（住宅地）",
    group: "住まい",
    raw: (m) => (hasLandPrice(m.landPrice.value) ? m.landPrice.value : null),
    format: (v) => `${v.toLocaleString()}円/㎡`,
    fallback: "対象外",
    nationalAvg: { raw: (n) => n.landPrice },
  }),
  numericRow({
    key: "vacancy",
    label: "空き家率",
    group: "住まい",
    raw: (m) => (hasVacancy(m.vacancy) ? m.vacancy.rate : null),
    format: (v) => `${v.toFixed(1)}%`,
    fallback: "対象外",
    nationalAvg: { raw: (n) => n.vacancyRate },
  }),
  // ---- 子育て・生活 ----
  numericRow({
    key: "waitlist",
    label: "待機児童数",
    group: "子育て・生活",
    raw: (m) => (isWaitlistDisclosed(m.waitlistChildren) ? m.waitlistChildren.value : null),
    format: (v) => `${v}人`,
    fallback: "非公表",
  }),
  numericRow({
    key: "stations",
    label: "鉄道駅数",
    group: "子育て・生活",
    raw: (m) => (m.amenities && isAmenitiesCounted(m.amenities.source) ? m.amenities.stations : null),
    format: (v) => `${v.toLocaleString()}駅`,
    fallback: "対象外",
  }),
  numericRow({
    key: "preschools",
    label: "保育園・幼稚園等",
    group: "子育て・生活",
    raw: (m) => (m.amenities && isAmenitiesCounted(m.amenities.source) ? m.amenities.preschools : null),
    format: (v) => `${v.toLocaleString()}施設`,
    fallback: "対象外",
  }),
  numericRow({
    key: "medical",
    label: "医療機関数",
    group: "子育て・生活",
    raw: (m) => (m.amenities && isAmenitiesCounted(m.amenities.source) ? m.amenities.medicalFacilities : null),
    format: (v) => `${v.toLocaleString()}施設`,
    fallback: "対象外",
  }),
  numericRow({
    key: "shelters",
    label: "指定緊急避難場所",
    group: "子育て・生活",
    raw: (m) => (m.shelters && hasShelterData(m.shelters.source) ? m.shelters.count : null),
    format: (v) => `${v.toLocaleString()}か所`,
    fallback: "未収録",
  }),
  // ---- 災害リスク ----
  {
    key: "flood",
    label: "最大浸水深（洪水）",
    group: "災害リスク",
    value: floodText,
  },
  {
    key: "landslide",
    label: "土砂災害",
    group: "災害リスク",
    value: (m) => landslideLevelLabel(landslideLevelOf(m.hazard)),
  },
  {
    key: "tsunami",
    label: "津波浸水想定",
    group: "災害リスク",
    value: (m) => coastalHazardLabel(tsunamiLevelOf(m.hazard), m.hazard.tsunamiDepth),
  },
  {
    key: "stormSurge",
    label: "高潮浸水想定",
    group: "災害リスク",
    value: (m) => coastalHazardLabel(stormSurgeLevelOf(m.hazard), m.hazard.stormSurgeDepth),
  },
  {
    key: "liquefaction",
    label: "液状化傾向",
    group: "災害リスク",
    value: (m) => liquefactionLabel(liquefactionLevelOf(m.hazard), m.hazard.liquefactionLabel),
  },
];

/** 表示順のグループ一覧（COMPARE_ROWS の出現順） */
export const COMPARE_GROUPS: CompareGroup[] = ["基本", "住まい", "子育て・生活", "災害リスク"];
