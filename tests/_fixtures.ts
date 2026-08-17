import type { Municipality, MuniSummary, Metric, HazardInfo } from "@/lib/types";
import type { DenkiAreaPricing, DenkiPlan, DenkiPlansFile } from "@/lib/denkiPlans";

export function metric(partial: Partial<Metric> = {}): Metric {
  return {
    value: 0,
    unit: "円/月",
    source: "テスト",
    asOf: "2023",
    isEstimated: false,
    ...partial,
  };
}

export function hazard(partial: Partial<HazardInfo> = {}): HazardInfo {
  return {
    hasFloodRisk: false,
    hasLandslideRisk: false,
    note: "",
    source: "国土数値情報（reinfolib XKT026/029）",
    asOf: "2024",
    ...partial,
  };
}

// トップ地図の軽量サマリ（MuniSummary）。検索・地図色付け系コンポーネントの
// テスト入力に使う。既定は「川口市（埼玉）」相当。
export function muniSummary(partial: Partial<MuniSummary> = {}): MuniSummary {
  return {
    code: "11203",
    pref: "saitama",
    name: "川口市",
    rent: 60000,
    landPrice: 200000,
    populationTrend: "横ばい",
    foreignRatio: 2,
    floodLevel: 0,
    landslideLevel: 0,
    tsunamiLevel: -1,
    stormSurgeLevel: -1,
    liquefactionLevel: -1,
    ...partial,
  };
}

export function muni(partial: Partial<Municipality> = {}): Municipality {
  return {
    code: "11203",
    pref: "saitama",
    name: "川口市",
    population: 600000,
    populationTrend: "横ばい",
    rent: metric({ value: 60000 }),
    landPrice: metric({ value: 200000, unit: "円/㎡" }),
    waitlistChildren: metric({ value: 0, unit: "人" }),
    foreignResidents: metric({ value: 12000, unit: "人", source: "出入国在留管理庁 在留外国人統計" }),
    hazard: hazard(),
    ...partial,
  };
}

// IPSS 将来推計人口（実データ形）。センチネル形は各テストで source を上書きして作る。
export const FUTURE_POP_SOURCE = "国立社会保障・人口問題研究所 日本の地域別将来推計人口（令和5年推計）";

export function futurePop(
  partial: Partial<NonNullable<Municipality["futurePopulation"]>> = {},
): NonNullable<Municipality["futurePopulation"]> {
  return {
    base2020: 600000,
    total: { "2050": 580000 },
    young2050: 60000,
    working2050: 340000,
    elderly2050: 180000,
    source: FUTURE_POP_SOURCE,
    asOf: "2023",
    ...partial,
  };
}

// 電気料金プラン（/denki）。既定はアンペア制・3段階従量のダミー値。
// 最低料金制は denkiPricing({ basic: { type: "minimum", ... } }) で上書きする。
export function denkiPricing(partial: Partial<DenkiAreaPricing> = {}): DenkiAreaPricing {
  return {
    basic: { type: "ampere", yenPerMonth: { "30": 900, "40": 1200, "50": 1500 } },
    tiers: [
      { upTo: 120, yenPerKwh: 20 },
      { upTo: 300, yenPerKwh: 25 },
      { upTo: null, yenPerKwh: 28 },
    ],
    ...partial,
  };
}

export function denkiPlan(partial: Partial<DenkiPlan> = {}): DenkiPlan {
  return {
    offerId: "baseline-test",
    company: "大手電力",
    planName: "従量電灯B",
    kind: "baseline",
    areas: { tokyo: denkiPricing() },
    officialUrl: "https://example.com/",
    sourceUrl: "https://example.com/",
    sourceAsOf: "2026-08",
    ...partial,
  };
}

export function denkiPlansFile(partial: Partial<DenkiPlansFile> = {}): DenkiPlansFile {
  return { asOf: "2026-08", plans: [denkiPlan()], ...partial };
}
