// 地図の「条件フィルタ」定義。家賃上限・地価上限・浸水リスクなしで自治体を絞り込み、
// 非該当を減光する（非表示にはしない＝地理的文脈を残す）。
//
// 件数カウント（JS）と地図描画（MapLibre 式）で同じ判定が要るが、両者を別々に
// 手書きすると条件がずれる（件数と表示が食い違うのが本機能の致命傷）。そこで
// 各条件を FILTER_SPECS の1エントリに集約し、matchesFilter / buildMatchExpression /
// isFilterActive をそこから機械的に導出する（条件の単一ソース）。

import type { MuniSummary } from "./types";

export type MapFilters = {
  rentMax: number | null;   // 家賃上限（円/月）。null=条件なし
  landMax: number | null;   // 地価上限（円/㎡）。null=条件なし
  floodMax: number | null;  // 許容する最大浸水深ランク（0..6）。null=条件なし。0=浸水なしに限定
};

export const EMPTY_FILTERS: MapFilters = { rentMax: null, landMax: null, floodMax: null };

// 数値プロパティで「下限 op floor かつ 値 <= 上限」を判定する条件の仕様。
// prop は MuniSummary のフィールド名であり、地図側の geojson プロパティ名とも一致する。
type FilterSpec = {
  /** MapFilters の上限フィールド */
  max: keyof MapFilters;
  /** MuniSummary の数値フィールド ＝ geojson プロパティ名 */
  prop: "rent" | "landPrice" | "floodLevel";
  /** 下限の比較演算子（rent/land は正値=`>` 0、flood は評価済み=`>=` 0）*/
  floorOp: ">" | ">=";
  /** 下限の基準値 */
  floor: number;
  /** 地図式で geojson プロパティ欠損時に使う既定値（下限を満たさない値にする） */
  missingDefault: number;
};

// 家賃/地価は「正値（欠損 rent/land<=0 は非該当）」。浸水は「評価済み floodLevel>=0
// （reinfolib 圏外の未評価 -1 は“安全”扱いしない=honesty）」かつ上限以下。
const FILTER_SPECS: readonly FilterSpec[] = [
  { max: "rentMax", prop: "rent", floorOp: ">", floor: 0, missingDefault: 0 },
  { max: "landMax", prop: "landPrice", floorOp: ">", floor: 0, missingDefault: 0 },
  { max: "floodMax", prop: "floodLevel", floorOp: ">=", floor: 0, missingDefault: -1 },
];

const floorOk = (op: ">" | ">=", v: number, floor: number) => (op === ">" ? v > floor : v >= floor);

// 浸水深の上限セグメント。値は lib/hazardScale.ts の浸水深ランク（0=なし, 2=0.5〜3m, 3=3〜5m）。
export const FLOOD_MAX_OPTIONS = [
  { label: "浸水なし", value: 0 },
  { label: "〜3m", value: 2 },
  { label: "〜5m", value: 3 },
] as const;

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
  return FILTER_SPECS.some((s) => f[s.max] != null);
}

// 件数カウント用の JS 判定。欠損（rent/landPrice<=0）は「条件を満たすと確認できない」
// ため、その指標で絞り込み中なら非該当扱い。floodMax は「評価済み（floodLevel>=0）かつ
// 浸水深ランクが上限以下」のみ該当とし、reinfolib 圏外で未評価（-1）の自治体を“安全”扱い
// しない（honesty）。floodMax=0 は浸水なしに限定（旧 noFlood 相当）。
export function matchesFilter(m: MuniSummary, f: MapFilters): boolean {
  for (const spec of FILTER_SPECS) {
    const max = f[spec.max];
    if (max == null) continue;
    const v = m[spec.prop];
    if (!(floorOk(spec.floorOp, v, spec.floor) && v <= max)) return false;
  }
  return true;
}

// 描画用の MapLibre 式。フィルタ無効なら null（呼び出し側で減光レイヤーを消す）。
// matchesFilter と同じ FILTER_SPECS から生成するので、件数と地図表示は必ず一致する。
export function buildMatchExpression(f: MapFilters): unknown | null {
  if (!isFilterActive(f)) return null;
  const clauses: unknown[] = [];
  for (const spec of FILTER_SPECS) {
    const max = f[spec.max];
    if (max == null) continue;
    // 未評価/欠損は missingDefault（下限を満たさない値）に落とし、非該当として減光側へ。
    // ["to-number", x, fallback] は null→0 を「正常変換」するため欠損検出に使えない。
    // ["has"] でプロパティ欠損を明示的に missingDefault へ落とす。
    const v = ["case", ["has", spec.prop], ["to-number", ["get", spec.prop]], spec.missingDefault];
    clauses.push(["all", [spec.floorOp, v, spec.floor], ["<=", v, max]]);
  }
  return ["all", ...clauses];
}
