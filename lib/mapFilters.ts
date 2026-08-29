// 地図の「条件フィルタ」定義。家賃上限・地価上限・浸水リスク・空き家率上限・
// 2050年人口の下限で自治体を絞り込み、非該当を減光する（非表示にはしない＝地理的文脈を残す）。
//
// 件数カウント（JS）と地図描画（MapLibre 式）で同じ判定が要るが、両者を別々に
// 手書きすると条件がずれる（件数と表示が食い違うのが本機能の致命傷）。そこで
// 各条件を FILTER_SPECS の1エントリに集約し、matchesFilter / buildMatchExpression /
// isFilterActive / URL コーデックをそこから機械的に導出する（条件の単一ソース）。

import type { MuniSummary } from "./types";

export type MapFilters = {
  rentMax: number | null;    // 家賃上限（円/月）。null=条件なし
  landMax: number | null;    // 地価上限（円/㎡）。null=条件なし
  floodMax: number | null;   // 許容する最大浸水深ランク（0..6）。null=条件なし。0=浸水なしに限定
  vacancyMax: number | null; // 空き家率上限（%）。null=条件なし
  futureMin: number | null;  // 2050年推計人口の増減率の下限（%）。null=条件なし。0=増加見込みに限定
};

export const EMPTY_FILTERS: MapFilters = {
  rentMax: null, landMax: null, floodMax: null, vacancyMax: null, futureMin: null,
};

// 1条件の仕様。条件は「有効値である（floorOp/floor を満たす）かつ 選択値と dir 方向で
// 比較して満たす」。prop は MuniSummary のフィールド名であり、geojson プロパティ名とも一致。
type FilterSpec = {
  /** MapFilters のフィールド ＝ URL クエリキー */
  key: keyof MapFilters;
  /** MuniSummary の数値フィールド ＝ geojson プロパティ名 */
  prop: "rent" | "landPrice" | "floodLevel" | "vacancyRate" | "futureChangeRate";
  /** 比較の向き。max=選択値以下が該当 / min=選択値以上が該当 */
  dir: "max" | "min";
  /** 有効値の下限判定（欠損・センチネルを非該当に落とす）。 */
  floorOp: ">" | ">=";
  floor: number;
  /** 地図式で geojson プロパティ欠損時に使う既定値（floor を満たさない値にする） */
  missingDefault: number;
};

// 家賃/地価は「正値（欠損 rent/land<=0 は非該当）」。浸水は「評価済み floodLevel>=0
// （reinfolib 圏外の未評価 -1 を“安全”扱いしない=honesty）」。空き家率・将来人口増減率は
// フィールド欠落=データなし（集計対象外を「条件を満たす」と見せない）。増減率は負値が
// 正常値のため、有効判定は「実データの下限を十分下回る floor 以上」で表現する。
const FILTER_SPECS: readonly FilterSpec[] = [
  { key: "rentMax", prop: "rent", dir: "max", floorOp: ">", floor: 0, missingDefault: 0 },
  { key: "landMax", prop: "landPrice", dir: "max", floorOp: ">", floor: 0, missingDefault: 0 },
  { key: "floodMax", prop: "floodLevel", dir: "max", floorOp: ">=", floor: 0, missingDefault: -1 },
  { key: "vacancyMax", prop: "vacancyRate", dir: "max", floorOp: ">=", floor: 0, missingDefault: -1 },
  { key: "futureMin", prop: "futureChangeRate", dir: "min", floorOp: ">=", floor: -1000, missingDefault: -9999 },
];

const floorOk = (op: ">" | ">=", v: number, floor: number) => (op === ">" ? v > floor : v >= floor);
const limitOk = (dir: "max" | "min", v: number, limit: number) => (dir === "max" ? v <= limit : v >= limit);

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

// 空き家率上限（%）。しきい値は地図コロプレス（lib/mapMetrics.ts）の下位側と揃える
// （全国平均13.8%が「〜15%」に収まる）。
export const VACANCY_MAX_OPTIONS = [
  { label: "〜10%", value: 10 },
  { label: "〜15%", value: 15 },
  { label: "〜20%", value: 20 },
] as const;

// 2050年推計人口の増減率の下限（%）。0=増加見込みに限定。IPSS 公的推計の公表値による
// 絞り込みで、対象外（浜通り13市町村・北方領土等）はデータなしとして非該当。
export const FUTURE_MIN_OPTIONS = [
  { label: "増加見込み", value: 0 },
  { label: "-10%まで", value: -10 },
  { label: "-20%まで", value: -20 },
] as const;

// URL コーデックの検証用: キー → 許容値（選択肢に無い値のクエリは条件なしに落とす）。
const OPTIONS_BY_KEY: Record<keyof MapFilters, readonly { label: string; value: number }[]> = {
  rentMax: RENT_MAX_OPTIONS,
  landMax: LAND_MAX_OPTIONS,
  floodMax: FLOOD_MAX_OPTIONS,
  vacancyMax: VACANCY_MAX_OPTIONS,
  futureMin: FUTURE_MIN_OPTIONS,
};

export function isFilterActive(f: MapFilters): boolean {
  return FILTER_SPECS.some((s) => f[s.key] != null);
}

// 件数カウント用の JS 判定。欠損・センチネルは「条件を満たすと確認できない」ため、
// その指標で絞り込み中なら非該当扱い（honesty: 未評価・対象外を“安全/該当”扱いしない）。
export function matchesFilter(m: MuniSummary, f: MapFilters): boolean {
  for (const spec of FILTER_SPECS) {
    const limit = f[spec.key];
    if (limit == null) continue;
    const v = m[spec.prop] ?? spec.missingDefault;
    if (!(floorOk(spec.floorOp, v, spec.floor) && limitOk(spec.dir, v, limit))) return false;
  }
  return true;
}

// 描画用の MapLibre 式。フィルタ無効なら null（呼び出し側で減光レイヤーを消す）。
// matchesFilter と同じ FILTER_SPECS から生成するので、件数と地図表示は必ず一致する。
export function buildMatchExpression(f: MapFilters): unknown | null {
  if (!isFilterActive(f)) return null;
  const clauses: unknown[] = [];
  for (const spec of FILTER_SPECS) {
    const limit = f[spec.key];
    if (limit == null) continue;
    // 未評価/欠損は missingDefault（floor を満たさない値）に落とし、非該当として減光側へ。
    // ["to-number", x, fallback] は null→0 を「正常変換」するため欠損検出に使えない。
    // ["has"] でプロパティ欠損を明示的に missingDefault へ落とす。
    const v = ["case", ["has", spec.prop], ["to-number", ["get", spec.prop]], spec.missingDefault];
    clauses.push(["all", [spec.floorOp, v, spec.floor], [spec.dir === "max" ? "<=" : ">=", v, limit]]);
  }
  return ["all", ...clauses];
}

// ---- URL 同期（?rentMax=60000&futureMin=0 のような共有可能なクエリ） ----
// クエリキーは MapFilters のフィールド名そのもの。値は選択肢（OPTIONS_BY_KEY）に
// ある場合のみ採用し、それ以外は条件なしに落とす（不正値で件数0の地図を共有させない）。

/** location.search からフィルタ状態を復元する。未指定・不正値は null（条件なし）。 */
export function parseFilters(search: string): MapFilters {
  const params = new URLSearchParams(search);
  const out: MapFilters = { ...EMPTY_FILTERS };
  for (const spec of FILTER_SPECS) {
    const raw = params.get(spec.key);
    if (raw == null) continue;
    const v = Number(raw);
    if (OPTIONS_BY_KEY[spec.key].some((o) => o.value === v)) out[spec.key] = v;
  }
  return out;
}

/**
 * フィルタ状態を URLSearchParams に反映する（既存の他パラメータ ?code=/?pref= 等は
 * 触らない）。null の条件はキーごと削除し、クエリを最小に保つ。
 */
export function applyFiltersToParams(f: MapFilters, params: URLSearchParams): void {
  for (const spec of FILTER_SPECS) {
    const v = f[spec.key];
    if (v == null) params.delete(spec.key);
    else params.set(spec.key, String(v));
  }
}
