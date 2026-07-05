import type { Municipality, MuniSummary, Metric, HazardInfo } from "@/lib/types";

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
