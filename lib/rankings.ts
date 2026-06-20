// 全国ランキングページのデータ駆動定義。地図指標(mapMetrics)や県集計(prefStats)と
// 同じく「指標の定義を1か所に集約し、ページは定義から描画する」方針。
//
// 対象は market-level の1自治体＝1エントリにするため、政令市の行政区(level:"ward")は
// 除外して親市との重複を避ける。東京23特別区は tokyo.json 上 level:"muni" なので含まれる。

import type { Municipality } from "./types";
import { hasRent } from "./rentColor";
import { hasLandPrice } from "./landPrice";
import { isWaitlistDisclosed } from "./waitlist";

export type RankingDef = {
  slug: string;
  /** ページ H1 / 見出し用のフレーズ */
  title: string;
  /** ランキング一覧・パンくず用の短いラベル */
  shortLabel: string;
  /** meta description のひな型（{top1} を1位自治体名に置換） */
  description: string;
  /** 本文リード */
  lead: string;
  /** テーブルの値カラム見出し */
  columnLabel: string;
  order: "asc" | "desc";
  /** 候補に含める条件（対象外・データなしを除外） */
  qualifies: (m: Municipality) => boolean;
  /** 並び替えキー */
  sortValue: (m: Municipality) => number;
  /** 値カラムの表示テキスト */
  display: (m: Municipality) => string;
};

export const RANKINGS: RankingDef[] = [
  {
    slug: "rent-cheap",
    title: "家賃が安い市区町村ランキング",
    shortLabel: "家賃が安い",
    description:
      "全国の市区町村を民営借家中央値が安い順にランキング。最も家賃が安いのは{top1}。家賃相場の低い自治体を政府統計（住宅・土地統計調査）の実データで比較できます。",
    lead: "全国の市区町村を民営借家中央値が安い順に並べたランキングです。",
    columnLabel: "家賃中央値",
    order: "asc",
    qualifies: (m) => hasRent(m.rent.value),
    sortValue: (m) => m.rent.value,
    display: (m) => `${m.rent.value.toLocaleString()}円/月`,
  },
  {
    slug: "rent-high",
    title: "家賃が高い市区町村ランキング",
    shortLabel: "家賃が高い",
    description:
      "全国の市区町村を民営借家中央値が高い順にランキング。最も家賃が高いのは{top1}。家賃相場の高い自治体を政府統計（住宅・土地統計調査）の実データで比較できます。",
    lead: "全国の市区町村を民営借家中央値が高い順に並べたランキングです。",
    columnLabel: "家賃中央値",
    order: "desc",
    qualifies: (m) => hasRent(m.rent.value),
    sortValue: (m) => m.rent.value,
    display: (m) => `${m.rent.value.toLocaleString()}円/月`,
  },
  {
    slug: "land-price-high",
    title: "地価が高い市区町村ランキング",
    shortLabel: "地価が高い",
    description:
      "全国の市区町村を住宅地の地価が高い順にランキング。最も地価が高いのは{top1}。地価公示・地価調査の実データで自治体を比較できます。",
    lead: "全国の市区町村を住宅地の地価（円/㎡）が高い順に並べたランキングです。",
    columnLabel: "地価（住宅地）",
    order: "desc",
    qualifies: (m) => hasLandPrice(m.landPrice.value),
    sortValue: (m) => m.landPrice.value,
    display: (m) => `${m.landPrice.value.toLocaleString()}円/㎡`,
  },
  {
    slug: "waitlist-zero",
    title: "待機児童ゼロの市区町村",
    shortLabel: "待機児童ゼロ",
    description:
      "待機児童ゼロの市区町村を人口が多い順に掲載。{top1}など、子育て世帯が注目する待機児童ゼロの自治体をこども家庭庁の公表値で確認できます。",
    lead: "待機児童数が0人の市区町村を、人口が多い順に掲載しています（こども家庭庁の公表値）。",
    columnLabel: "人口",
    order: "desc",
    qualifies: (m) => isWaitlistDisclosed(m.waitlistChildren) && m.waitlistChildren.value === 0,
    sortValue: (m) => m.population,
    display: (m) => `${m.population.toLocaleString()}人`,
  },
];

const BY_SLUG = new Map(RANKINGS.map((r) => [r.slug, r]));

export function getRankingBySlug(slug: string): RankingDef | null {
  return BY_SLUG.get(slug) ?? null;
}

/** 市区町村のみ（政令市の行政区を除外）。ランキングは market-level の1自治体1エントリ。 */
export function muniLevelOnly(all: Municipality[]): Municipality[] {
  return all.filter((m) => (m.level ?? "muni") !== "ward");
}

/** 定義に従って候補を抽出・整列して返す（limit 指定時は上位 limit 件）。 */
export function rankBy(def: RankingDef, munis: Municipality[], limit?: number): Municipality[] {
  const sorted = munis
    .filter(def.qualifies)
    .sort((a, b) =>
      def.order === "asc" ? def.sortValue(a) - def.sortValue(b) : def.sortValue(b) - def.sortValue(a),
    );
  return typeof limit === "number" ? sorted.slice(0, limit) : sorted;
}
