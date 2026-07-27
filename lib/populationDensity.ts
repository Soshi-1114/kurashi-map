// 人口密度（人/km²）。人口（国勢調査）÷ 面積（国土地理院 面積調 areaKm2）で
// 実行時に算出する（保存しない）。面積未収録・人口0の自治体は null（対象外）。

import type { Municipality } from "./types";

/** 人口密度（人/km²）。算出できない場合は null。 */
export function populationDensity(m: Municipality): number | null {
  if (!(m.population > 0)) return null;
  if (m.areaKm2 == null || !(m.areaKm2 > 0)) return null;
  return m.population / m.areaKm2;
}

/** 表示用: "14,777人/km²"（整数丸め）。 */
export function densityText(density: number): string {
  return `${Math.round(density).toLocaleString()}人/km²`;
}
