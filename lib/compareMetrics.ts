// 自治体比較ページ（/compare）の行定義。フル Municipality から表示文字列を作る
// 純関数の集まりで、サーバー/クライアント両方から使える。
//
// honesty 方針: 欠損はセンチネル判定ヘルパー（hasRent / hasVacancy / hasShelterData 等）で
// 判定し、「データなし」「対象外」「非公表」「未収録」を値と区別して表示する。
// NaN / undefined がそのまま画面に出る経路を作らない。

import type { Municipality } from "./types";
import { hasRent } from "./rentColor";
import { hasLandPrice } from "./landPrice";
import { hasVacancy, vacancyRateText } from "./vacancy";
import { isWaitlistDisclosed } from "./waitlist";
import { hasForeignData, foreignRatioPct } from "./foreignResidents";
import { isAmenitiesCounted, isHazardEvaluated } from "./coverage";
import { hasShelterData } from "./shelters";
import { populationDensity, densityText } from "./populationDensity";
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

export type CompareRowDef = {
  key: string;
  label: string;
  group: CompareGroup;
  /** 表示文字列（欠損は「データなし／対象外／非公表／未収録」等を返す） */
  value: (m: Municipality) => string;
};

const NO_VALUE = "—";

function changeRateText(m: Municipality): string {
  if (typeof m.populationChangeRate !== "number" || !(m.population > 0)) return NO_VALUE;
  const v = m.populationChangeRate;
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
}

function floodText(m: Municipality): string {
  if (!isHazardEvaluated(m.hazard.source)) return "対象外";
  if (floodGraded(m.hazard)) return floodLevelLabel(floodLevelOf(m.hazard));
  return m.hazard.hasFloodRisk ? "想定あり" : "想定なし";
}

export const COMPARE_ROWS: CompareRowDef[] = [
  // ---- 基本 ----
  {
    key: "population",
    label: "人口",
    group: "基本",
    value: (m) => (m.population > 0 ? `${m.population.toLocaleString()}人` : NO_VALUE),
  },
  {
    key: "populationChangeRate",
    label: "人口増減率（2020→2025）",
    group: "基本",
    value: changeRateText,
  },
  {
    key: "density",
    label: "人口密度",
    group: "基本",
    value: (m) => {
      const d = populationDensity(m);
      return d != null ? densityText(d) : NO_VALUE;
    },
  },
  {
    key: "area",
    label: "面積",
    group: "基本",
    value: (m) => (m.areaKm2 != null && m.areaKm2 > 0 ? `${m.areaKm2.toLocaleString()}km²` : NO_VALUE),
  },
  {
    key: "foreignRatio",
    label: "外国人住民比率",
    group: "基本",
    value: (m) =>
      hasForeignData(m.foreignResidents.source) && m.population > 0
        ? `${foreignRatioPct(m).toFixed(2)}%`
        : "対象外",
  },
  // ---- 住まい ----
  {
    key: "rent",
    label: "家賃中央値（民営借家）",
    group: "住まい",
    value: (m) => (hasRent(m.rent.value) ? `${m.rent.value.toLocaleString()}円/月` : "データなし"),
  },
  {
    key: "landPrice",
    label: "地価（住宅地）",
    group: "住まい",
    value: (m) => (hasLandPrice(m.landPrice.value) ? `${m.landPrice.value.toLocaleString()}円/㎡` : "対象外"),
  },
  {
    key: "vacancy",
    label: "空き家率",
    group: "住まい",
    value: (m) => (hasVacancy(m.vacancy) ? vacancyRateText(m.vacancy) : "対象外"),
  },
  // ---- 子育て・生活 ----
  {
    key: "waitlist",
    label: "待機児童数",
    group: "子育て・生活",
    value: (m) => (isWaitlistDisclosed(m.waitlistChildren) ? `${m.waitlistChildren.value}人` : "非公表"),
  },
  {
    key: "stations",
    label: "鉄道駅数",
    group: "子育て・生活",
    value: (m) =>
      m.amenities && isAmenitiesCounted(m.amenities.source) ? `${m.amenities.stations.toLocaleString()}駅` : "対象外",
  },
  {
    key: "preschools",
    label: "保育園・幼稚園等",
    group: "子育て・生活",
    value: (m) =>
      m.amenities && isAmenitiesCounted(m.amenities.source)
        ? `${m.amenities.preschools.toLocaleString()}施設`
        : "対象外",
  },
  {
    key: "medical",
    label: "医療機関数",
    group: "子育て・生活",
    value: (m) =>
      m.amenities && isAmenitiesCounted(m.amenities.source)
        ? `${m.amenities.medicalFacilities.toLocaleString()}施設`
        : "対象外",
  },
  {
    key: "shelters",
    label: "指定緊急避難場所",
    group: "子育て・生活",
    value: (m) =>
      m.shelters && hasShelterData(m.shelters.source) ? `${m.shelters.count.toLocaleString()}か所` : "未収録",
  },
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
