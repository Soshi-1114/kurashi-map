// 将来推計人口（IPSS 令和5(2023)年推計）のアクセサ。UI・ランキングは必ずここを経由する
// （hasRent / hasVacancy 等と同じ「対象判定をヘルパーに集約する」方針）。
//
// 派生値（増減率・高齢化率）は保存せず、ここで生値から算出する（人口密度・外国人比率と
// 同じ「派生値は保存しない」方針）。分母は必ず IPSS 内部の2020年基準人口（base2020）で、
// 調査基準の異なる現在の population（2025年国勢調査）とは混ぜない。
//
// データなしの表現は null。増減率は負値が正常値（減少）なので、foreignRatio の -1 の
// ような負のセンチネル数値は実データと衝突し得るため使わない。

import type { Municipality } from "./types";
import { signedPct } from "./format";

type FuturePopulation = NonNullable<Municipality["futurePopulation"]>;

/** フィールド未収録（ETL 未実行）時の nodata センチネル（SHELTER_NODATA と同じ役割）。 */
export const FUTURE_POP_NODATA = "対象外（未収録）";

/**
 * NoData 表示用の source / asOf。hasFuturePopulation の否定分岐では
 * m.futurePopulation が undefined に絞り込まれセンチネルの source を参照できないため、
 * UI は絞り込み前の値をこのアクセサ経由で取り出す。
 */
export function futurePopSource(fp: Municipality["futurePopulation"]): string {
  return fp?.source ?? FUTURE_POP_NODATA;
}

export function futurePopAsOf(fp: Municipality["futurePopulation"]): string {
  return fp?.asOf ?? "-";
}

/**
 * 市区町村別の将来推計があるか。フィールド未収録（ETL 未実行）と、
 * 「対象外」センチネル（浜通り13市町村・北方領土6村・浜松市中央区/浜名区）の両方を弾く。
 */
export function hasFuturePopulation(fp: Municipality["futurePopulation"]): fp is FuturePopulation {
  return fp != null && !String(fp.source ?? "").includes("対象外") && fp.base2020 > 0;
}

/** 指定年の推計総人口。データなしは null。 */
export function futureTotal(fp: Municipality["futurePopulation"], year: string): number | null {
  if (!hasFuturePopulation(fp)) return null;
  const v = fp.total[year];
  return typeof v === "number" ? v : null;
}

/**
 * 2020年基準人口 → 2050年推計人口の増減率（%）。例: -32.4 = 32.4%減。
 * データなしは null。
 */
export function futureChangeRate2050(fp: Municipality["futurePopulation"]): number | null {
  if (!hasFuturePopulation(fp)) return null;
  const t2050 = futureTotal(fp, "2050");
  return t2050 == null ? null : ((t2050 - fp.base2020) / fp.base2020) * 100;
}

/**
 * 2020→2050年増減率の表示テキスト（符号付き小数1桁%）。データなしは "—"。
 * ランキングの display・meta description・地図ハブが共有する
 * （vacancyRateText / densityText と同じ「表示整形も派生値としてここに置く」方針）。
 */
export function futureRateText(fp: Municipality["futurePopulation"]): string {
  const r = futureChangeRate2050(fp);
  return r == null ? "—" : `${signedPct(r)}%`;
}

/** 2050年の年齢3区分の構成比（対2050年総人口、%）。データなし・総人口0は null。 */
export function ageComposition2050(
  fp: Municipality["futurePopulation"],
): { young: number; working: number; elderly: number } | null {
  if (!hasFuturePopulation(fp)) return null;
  const t2050 = futureTotal(fp, "2050");
  if (t2050 == null || t2050 <= 0) return null;
  const pct = (v: number) => (v / t2050) * 100;
  return { young: pct(fp.young2050), working: pct(fp.working2050), elderly: pct(fp.elderly2050) };
}

/** 2050年の高齢化率（65歳以上 ÷ 総人口、%）。データなしは null。 */
export function elderlyRatio2050(fp: Municipality["futurePopulation"]): number | null {
  return ageComposition2050(fp)?.elderly ?? null;
}
