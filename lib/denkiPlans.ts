// 電気料金プランデータ（data/denki-plans.json、手動整備）の型・アクセス・検証。
//
// エリア判定（lib/denki.ts）とは意図的に分離している: エリア名を表示するだけの
// ページ（自治体詳細の導線など）が、料金 JSON をバンドルに引き込まないため。
// 型と整合性検証をここに集約し、実 JSON はテスト（tests/lib/denkiPlans.test.ts）で
// 常時検証する（scripts/validate-data.mjs は自治体 JSON 専用で、このファイルは
// 対象外。検証の入口が2つある事実は validate-data.mjs 冒頭にも明記）。

import plansJson from "../data/denki-plans.json";
import { DENKI_AREAS, type DenkiArea } from "./denki";

/** 対応する契約アンペア（アンペア制プランの基本料金表のキー）。追加はここ1箇所。 */
export const AMPERES = [30, 40, 50] as const;
export type Ampere = (typeof AMPERES)[number];

/** 基本料金。アンペア制（東日本・中部・北陸・九州の従量電灯B型）か最低料金制（関西・中国・四国・沖縄の従量電灯A型）。 */
export type DenkiBasicCharge =
  | { type: "ampere"; yenPerMonth: Record<`${Ampere}`, number> }
  | { type: "minimum"; yenPerMonth: number; includedKwh: number };

/** 従量料金の段階。upTo は月間使用量の上限 kWh（最終段階は null = 上限なし）。 */
export type DenkiTier = { upTo: number | null; yenPerKwh: number };

export type DenkiAreaPricing = { basic: DenkiBasicCharge; tiers: DenkiTier[] };

export type DenkiPlan = {
  /** env のアフィリエイトリンク設定と対応する一意 ID（baseline は対応不要） */
  offerId: string;
  company: string;
  planName: string;
  /** baseline = 大手電力の規制料金（比較の基準）。offer = 送客対象の新電力プラン */
  kind: "baseline" | "offer";
  areas: Partial<Record<DenkiArea, DenkiAreaPricing>>;
  officialUrl: string;
  /** 料金表の出典ページ（officialUrl と同一でも可） */
  sourceUrl: string;
  /** 料金表を確認した時点（YYYY-MM-DD または YYYY-MM） */
  sourceAsOf: string;
  notes?: string[];
};

export type DenkiPlansFile = { asOf: string; plans: DenkiPlan[] };

/** 料金プランデータ（検証はテストで実施済みの前提で型キャストする）。 */
export const DENKI_PLANS = plansJson as DenkiPlansFile;

/** プランデータの確認時点（asOf: YYYY-MM）を Date に変換する。sitemap の lastModified 用。 */
export function denkiPlansLastModified(file: DenkiPlansFile = DENKI_PLANS): Date {
  return new Date(`${file.asOf}-01T00:00:00Z`);
}

/**
 * プランデータの整合性検証。違反を文字列の配列で返す（空配列 = OK）。
 * 実 JSON はテストで常時検証し、手動整備ミス（baseline 欠落・単価 0・
 * offerId 重複など）を CI で捕まえる。
 */
export function validateDenkiPlans(file: DenkiPlansFile): string[] {
  const errors: string[] = [];
  if (!/^\d{4}-\d{2}$/.test(file.asOf)) errors.push(`asOf が YYYY-MM 形式でない: ${file.asOf}`);

  const ids = new Set<string>();
  const baselineAreas = new Set<DenkiArea>();

  for (const plan of file.plans) {
    const p = `plans[${plan.offerId}]`;
    if (ids.has(plan.offerId)) errors.push(`offerId が重複: ${plan.offerId}`);
    ids.add(plan.offerId);
    if (plan.kind !== "baseline" && plan.kind !== "offer") errors.push(`${p}: kind が不正: ${plan.kind}`);
    if (!/^https?:\/\//.test(plan.officialUrl)) errors.push(`${p}: officialUrl が URL でない`);
    if (!/^https?:\/\//.test(plan.sourceUrl)) errors.push(`${p}: sourceUrl が URL でない`);
    if (!/^\d{4}-\d{2}(-\d{2})?$/.test(plan.sourceAsOf)) errors.push(`${p}: sourceAsOf が日付形式でない: ${plan.sourceAsOf}`);

    const areaKeys = Object.keys(plan.areas) as DenkiArea[];
    if (areaKeys.length === 0) errors.push(`${p}: areas が空`);
    for (const area of areaKeys) {
      if (!DENKI_AREAS.includes(area)) {
        errors.push(`${p}: 不明なエリア: ${area}`);
        continue;
      }
      if (plan.kind === "baseline") {
        if (baselineAreas.has(area)) errors.push(`エリア ${area} に baseline が複数ある`);
        baselineAreas.add(area);
      }
      const pricing = plan.areas[area]!;
      const pa = `${p}.areas.${area}`;
      const basic = pricing.basic;
      if (basic.type === "ampere") {
        for (const a of AMPERES) {
          if (!(basic.yenPerMonth[`${a}`] > 0)) errors.push(`${pa}: 基本料金 ${a}A が正でない`);
        }
      } else if (basic.type === "minimum") {
        if (!(basic.yenPerMonth > 0)) errors.push(`${pa}: 最低料金が正でない`);
        if (!(basic.includedKwh >= 0)) errors.push(`${pa}: includedKwh が不正`);
      } else {
        errors.push(`${pa}: basic.type が不正`);
      }
      if (pricing.tiers.length === 0) errors.push(`${pa}: tiers が空`);
      let prev = 0;
      pricing.tiers.forEach((t, i) => {
        const last = i === pricing.tiers.length - 1;
        if (!(t.yenPerKwh > 0)) errors.push(`${pa}: tiers[${i}] の単価が正でない`);
        if (last) {
          if (t.upTo !== null) errors.push(`${pa}: 最終段階の upTo は null であるべき`);
        } else {
          if (t.upTo === null || !(t.upTo > prev)) errors.push(`${pa}: tiers[${i}] の upTo が昇順でない`);
          else prev = t.upTo;
        }
      });
    }
  }

  for (const area of DENKI_AREAS) {
    if (!baselineAreas.has(area)) errors.push(`エリア ${area} の baseline がない`);
  }
  return errors;
}
