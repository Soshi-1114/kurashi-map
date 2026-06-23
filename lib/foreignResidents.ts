// 在留外国人レイヤーの色・しきい値・対象判定。総数は data の foreignResidents:Metric
// （value=在留外国人総数）。人口比（%）は実行時に人口と突き合わせて算出し、データには
// 保存しない（人口更新と必ず整合させ、ドリフトを防ぐ単一ソースとして算出する）。
//
// 編集方針: 在留外国人比率は「多様性・国際性」の生活情報として中立的に提示する。
// 推計はせず実データのみ。欠損は明示する（家賃・地価・災害と同じ honesty 方針）。

import type { Metric, Municipality } from "./types";

// 人口比（%）の5段階しきい値（契約面として固定）。在留外国人統計 2024年12月の
// 全国分布（中央値≈1.8% / p90≈4.8%）を5バケットに広げる境界。
export const FOREIGN_RATIO_THRESHOLDS = [1, 2, 3, 5] as const;

// teal 系の5段階（淡→濃）。家賃=青・人口トレンド=紫⇔緑と被らない中立的な配色で、
// 色覚多様性にも配慮した順次配色。
export const FOREIGN_COLORS = [
  "#eef7f5",
  "#bce0d9",
  "#82c6bb",
  "#3f9a8e",
  "#0f6e63",
] as const;

// 人口比のデータなしセンチネル（北方領土など対象外）。0% は実データ（最淡色）として
// 扱うため、欠損は負値 -1 で表す（地図の塗り分けは <=-1 を「データなし」に分岐）。
export const FOREIGN_NODATA_RATIO = -1;

// 在留外国人統計の調査対象自治体か。北方領土6村は注4で対象外＝source に「対象外」を
// 含める（lib/coverage.ts と同じセンチネル方針）。
export function hasForeignData(source: string): boolean {
  return !String(source ?? "").includes("対象外");
}

// 在留外国人の人口比（%）。対象外・人口不明は FOREIGN_NODATA_RATIO(-1)。
export function foreignRatioPct(
  m: Pick<Municipality, "foreignResidents" | "population">,
): number {
  if (!hasForeignData(m.foreignResidents.source)) return FOREIGN_NODATA_RATIO;
  if (!(m.population > 0)) return FOREIGN_NODATA_RATIO;
  return (m.foreignResidents.value / m.population) * 100;
}

// 人口比が有効値か（地図・UI の「データなし」分岐用）。0% は有効。
export function hasForeignRatio(ratio: number): boolean {
  return ratio >= 0;
}

// 国籍内訳の開示判定（総数10人以下は国籍・地域等が秘匿＝注2）。内訳データは現状未収録
// だが、将来内訳を載せる際の「データ非開示」分岐に備えてロジックを用意する。
export function isNationalityDisclosed(total: number): boolean {
  return total > 10;
}

// 内訳1件（将来の国籍上位5件用）。現状の整形では未収録（任意フィールド）。
export type ForeignNationality = { nationality: string; count: number };

// Metric を直接受けるショートカット（出典文字列から対象外判定）。
export function isForeignEvaluated(m: Metric): boolean {
  return hasForeignData(m.source);
}
