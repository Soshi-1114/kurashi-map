// 電気料金の試算ロジック（純関数のみ・"use client" なし）。
//
// 試算はあくまで「目安」: 燃料費調整額・再エネ発電促進賦課金・各社の割引
// （口座振替割引等）は含まない。UI 側は必ず前提条件（含まない費目・使用量の
// 出典・確認時点）を表示し、断定表現（「〇円安くなる」）を使わないこと。

import type { DenkiArea } from "./denki";
import type { Ampere, DenkiAreaPricing, DenkiPlansFile } from "./denkiPlans";

/** 選択できる世帯人数。6人以上は使用量の手入力で対応する（合成値は作らない）。 */
export type HouseholdSize = 1 | 2 | 3 | 4 | 5;
export const HOUSEHOLD_SIZES: HouseholdSize[] = [1, 2, 3, 4, 5];

/**
 * 世帯人数 → 月間電気使用量の目安（kWh/月）。
 *
 * 出典: 環境省「令和5年度 家庭部門のCO2排出実態統計調査（確報値）」の
 * 世帯人数別 年間エネルギー種別消費量（電気、GJ/世帯・年）を、同調査自身の
 * 換算定義（1kWh = 3.6MJ）で kWh に換算し 12 で割った値（四捨五入）。
 * kWh の直接公表値は全国全体（3,911kWh/年）のみで、世帯人数別は GJ 公表
 * （図表集 図1-62、e-Stat statsDataId=0004029148）。全体値での逆換算検算は一致。
 * 公式区分は 1〜5人・6人以上の6区分。ここでは 5人の値までを持つ。
 */
export const HOUSEHOLD_KWH: Record<HouseholdSize, number> = {
  1: 201, // 2,406 kWh/年
  2: 330, // 3,958 kWh/年
  3: 428, // 5,131 kWh/年
  4: 476, // 5,717 kWh/年
  5: 538, // 6,453 kWh/年
};

export const HOUSEHOLD_KWH_SOURCE = {
  label: "環境省「令和5年度 家庭部門のCO2排出実態統計調査（確報値）」",
  url: "https://www.env.go.jp/earth/ondanka/ghg/kateiCO2tokei.html",
  asOf: "2023年度調査（令和7年6月公表）",
  note: "世帯人数別の年間電気消費量（GJ）を同調査の定義 1kWh=3.6MJ で換算し月平均にした値",
};

/** 世帯人数ごとの契約アンペア既定値（変更可能な初期値）。 */
export function defaultAmpere(householdSize: HouseholdSize): Ampere {
  return householdSize <= 2 ? 30 : 40;
}

/**
 * 1 プラン・1 エリアの月額目安（円、四捨五入）。
 * - アンペア制: 基本料金（契約 A 別） + 段階従量
 * - 最低料金制: 最低料金（最初の includedKwh を含む） + 超過分の段階従量
 *   （tiers の upTo は月間使用量の絶対値。最初の段階の下限は includedKwh）
 */
export function estimateMonthly(pricing: DenkiAreaPricing, kwh: number, ampere: Ampere): number {
  const { basic, tiers } = pricing;
  // charged = ここまでの kWh は課金済み（または基本料金に含まれる）
  let total = basic.type === "ampere" ? basic.yenPerMonth[`${ampere}`] : basic.yenPerMonth;
  let charged = basic.type === "minimum" ? Math.min(kwh, basic.includedKwh) : 0;
  for (const t of tiers) {
    const upper = Math.min(kwh, t.upTo ?? Infinity);
    if (upper <= charged) continue;
    total += (upper - charged) * t.yenPerKwh;
    charged = upper;
  }
  return Math.round(total);
}

export type OfferEstimate = {
  offerId: string;
  company: string;
  planName: string;
  kind: "baseline" | "offer";
  /** 公式サイト URL（UI が外部リンクを組み立てるのに使う。プラン JSON を引き直させない） */
  officialUrl: string;
  /** 月額目安（円） */
  monthlyYen: number;
  /** baseline との差額（負 = baseline より安い）。baseline 自身と baseline 不在時は null */
  diffYen: number | null;
  notes?: string[];
};

/**
 * 指定エリアで提供のある全プランの月額目安を、安い順に返す。
 * baseline（大手規制料金）もリストに含める（diffYen は null）。
 */
export function compareOffers(
  file: DenkiPlansFile,
  area: DenkiArea,
  kwh: number,
  ampere: Ampere,
): OfferEstimate[] {
  const inArea = file.plans
    .map((plan) => {
      const pricing = plan.areas[area];
      if (!pricing) return null;
      return { plan, monthlyYen: estimateMonthly(pricing, kwh, ampere) };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const baseline = inArea.find((x) => x.plan.kind === "baseline") ?? null;

  return inArea
    .map(({ plan, monthlyYen }) => ({
      offerId: plan.offerId,
      company: plan.company,
      planName: plan.planName,
      kind: plan.kind,
      officialUrl: plan.officialUrl,
      monthlyYen,
      diffYen:
        plan.kind === "offer" && baseline ? monthlyYen - baseline.monthlyYen : null,
      notes: plan.notes,
    }))
    .sort((a, b) => a.monthlyYen - b.monthlyYen);
}
