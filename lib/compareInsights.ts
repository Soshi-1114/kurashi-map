import type { Municipality } from "./types";
import { hasRent } from "./rentColor";
import { signedPct } from "./format";

/** 2〜3自治体の収録値を要約する。優劣や個人の節約額・入園可能性は推論しない。 */
export function compareInsights(munis: Municipality[]): string[] {
  if (munis.length < 2) return [];
  const name = (m: Municipality) => m.displayName ?? m.name;
  const points: string[] = [];
  if (munis.every(m => m.population > 0 && Number.isFinite(m.population))) points.push(`人口は、${munis.map(m => `${name(m)} ${m.population.toLocaleString("ja-JP")}人`).join("、")}です。`);
  if (munis.every(m => m.populationChangeRate != null && Number.isFinite(m.populationChangeRate))) {
    points.push(`2020年から2025年の人口増減率は、${munis.map(m => `${name(m)} ${signedPct(m.populationChangeRate!)}%`).join("、")}です。`);
  }
  const withRent = munis.filter(m => hasRent(m.rent.value));
  if (withRent.length === munis.length) {
    const dates = new Set(munis.map(m => m.rent.asOf));
    const values = munis.map(m => m.rent.value);
    const difference = Math.max(...values) - Math.min(...values);
    points.push(`民営借家の家賃平均は、${munis.map(m => `${name(m)} ${m.rent.value.toLocaleString("ja-JP")}円／月`).join("、")}です。${dates.size === 1 ? `最大差は${difference.toLocaleString("ja-JP")}円／月です。` : "基準時点が異なるため、差額は計算していません。"}現在の募集家賃や、同条件の住宅の差額ではありません。`);
  }
  return points.slice(0, 3);
}
