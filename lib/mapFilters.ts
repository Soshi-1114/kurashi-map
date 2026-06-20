// 地図の「条件フィルタ」定義。家賃上限・地価上限・浸水リスクなしで自治体を絞り込み、
// 非該当を減光する（非表示にはしない＝地理的文脈を残す）。判定ロジックは
// JS版（件数カウント用）と MapLibre 式版（描画用）を同じ条件で二重に持つ。

import type { MuniSummary } from "./types";

export type MapFilters = {
  rentMax: number | null;   // 家賃上限（円/月）。null=条件なし
  landMax: number | null;   // 地価上限（円/㎡）。null=条件なし
  noFlood: boolean;         // 浸水リスクなしに限定
};

export const EMPTY_FILTERS: MapFilters = { rentMax: null, landMax: null, noFlood: false };

// セグメント選択肢（離散値の方がスライダーよりデータスケールに合い操作も明確）
export const RENT_MAX_OPTIONS = [
  { label: "5万", value: 50000 },
  { label: "6万", value: 60000 },
  { label: "7万", value: 70000 },
] as const;

export const LAND_MAX_OPTIONS = [
  { label: "5万", value: 50000 },
  { label: "10万", value: 100000 },
  { label: "20万", value: 200000 },
] as const;

export function isFilterActive(f: MapFilters): boolean {
  return f.rentMax != null || f.landMax != null || f.noFlood;
}

// 件数カウント用の JS 判定。欠損（rent/landPrice<=0）は「条件を満たすと確認できない」
// ため、その指標で絞り込み中なら非該当扱い。
export function matchesFilter(m: MuniSummary, f: MapFilters): boolean {
  if (f.rentMax != null && !(m.rent > 0 && m.rent <= f.rentMax)) return false;
  if (f.landMax != null && !(m.landPrice > 0 && m.landPrice <= f.landMax)) return false;
  if (f.noFlood && m.hasFloodRisk) return false;
  return true;
}

// 描画用の MapLibre 式。フィルタ無効なら null（呼び出し側で減光レイヤーを消す）。
export function buildMatchExpression(f: MapFilters): unknown | null {
  if (!isFilterActive(f)) return null;
  const clauses: unknown[] = [];
  if (f.rentMax != null) {
    const rent = ["to-number", ["get", "rent"], 0];
    clauses.push(["all", [">", rent, 0], ["<=", rent, f.rentMax]]);
  }
  if (f.landMax != null) {
    const land = ["to-number", ["get", "landPrice"], 0];
    clauses.push(["all", [">", land, 0], ["<=", land, f.landMax]]);
  }
  if (f.noFlood) {
    clauses.push(["==", ["get", "hasFloodRisk"], 0]);
  }
  return ["all", ...clauses];
}
