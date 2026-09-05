// 県ハブ（/area/{pref}）に出す「市区町村別の災害リスク一覧」の行データ。
//
// **順位も該当リストも作らない**のが設計の要。理由は実データにある:
//
// 1. 「浸水想定区域にかからない自治体」を抜き出すと、それは安全性ではなく
//    **浸水想定区域の指定状況**を映してしまう。沖縄 63%・鹿児島 63% が該当する一方、
//    埼玉・千葉・大阪・兵庫など19県は該当0件になる。これは河川管理者による区域指定の
//    進み具合の差で、災害の起きにくさではない。
// 2. 洪水（XKT026）が0でも津波・高潮の想定がある自治体が124件ある。大島町・八丈町は
//    津波レベル7〜8（最大クラス）だが洪水は0なので、「浸水想定なし」の一覧に載ってしまう。
//
// そこで **県内の全自治体をそのまま並べる**。選別しないので、上のような誤読が起きない。
// 「対象外（reinfolib 圏外）」も「想定なし」も「想定あり」も同じ表に並ぶ。

import type { Municipality } from "./types";
import { isHazardEvaluated } from "./coverage";
import {
  floodLevelOf,
  floodLevelLabel,
  landslideLevelOf,
  landslideLevelLabel,
  tsunamiLevelOf,
  stormSurgeLevelOf,
  coastalHazardLabel,
} from "./hazardScale";

export type PrefHazardRow = {
  code: string;
  pref: string;
  name: string;
  /** 評価対象か（false なら全列が「対象外」） */
  evaluated: boolean;
  /** 洪水浸水想定の最大深ランクの表示（未評価は「対象外」） */
  flood: string;
  /** 土砂災害区分の表示 */
  landslide: string;
  /** 津波の想定（沿岸のみ。内陸は「対象外」） */
  tsunami: string;
  /** 高潮の想定（沿岸のみ） */
  stormSurge: string;
  /** 何らかの想定がある指標の数（0〜4）。並べ替えには使わず、表示の補助のみ */
  riskCount: number;
};

const NOT_EVALUATED = "対象外";

/**
 * 県内の全市区町村を、行政コード順（＝行政の標準的な並び）で返す。
 * **リスクの大小で並べ替えない**（順位付けをしない方針。冒頭コメント参照）。
 */
export function buildPrefHazardRows(munis: Municipality[]): PrefHazardRow[] {
  return munis
    .slice()
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((m) => {
      const evaluated = isHazardEvaluated(m.hazard.source);
      if (!evaluated) {
        return {
          code: m.code,
          pref: m.pref,
          name: m.displayName ?? m.name,
          evaluated,
          flood: NOT_EVALUATED,
          landslide: NOT_EVALUATED,
          tsunami: NOT_EVALUATED,
          stormSurge: NOT_EVALUATED,
          riskCount: 0,
        };
      }
      const flood = floodLevelOf(m.hazard);
      const slide = landslideLevelOf(m.hazard);
      const tsunami = tsunamiLevelOf(m.hazard);
      const surge = stormSurgeLevelOf(m.hazard);
      return {
        code: m.code,
        pref: m.pref,
        name: m.displayName ?? m.name,
        evaluated,
        flood: floodLevelLabel(flood),
        landslide: landslideLevelLabel(slide),
        tsunami: coastalHazardLabel(tsunami, m.hazard.tsunamiDepth),
        stormSurge: coastalHazardLabel(surge, m.hazard.stormSurgeDepth),
        // 「想定あり」の数。0=すべて想定なし。対象外(-1)は数えない
        riskCount: [flood > 0, slide > 0, tsunami > 0, surge > 0].filter(Boolean).length,
      };
    });
}

/** 一覧の下に出す要約（何件が評価済みか・何件が想定ありか）。断定を避けた実数のみ。 */
export function summarizePrefHazard(rows: PrefHazardRow[]): {
  total: number;
  evaluated: number;
  anyRisk: number;
} {
  return {
    total: rows.length,
    evaluated: rows.filter((r) => r.evaluated).length,
    anyRisk: rows.filter((r) => r.riskCount > 0).length,
  };
}
