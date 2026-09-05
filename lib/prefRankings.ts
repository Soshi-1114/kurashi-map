// 都道府県ランキング（47都道府県を1本に並べる）のデータ駆動定義。
//
// 市区町村ランキング（lib/rankings.ts）とは「並べる対象」が違うだけでなく、
// **値の作り方が違う**ので定義を分けている。県ハブの「データ概況」
// （lib/prefAggregates.ts）は県内の *中央値* を出すが、それは
// 「兵庫県の空き家率は？」という検索意図に対する答えではない。ここでは
// **県内市区町村の実数を合算して県の値そのもの**を出す。
//
// honesty 方針:
// - 実数（人口・65歳以上人口など）が保存されている指標だけを対象にする。
//   家賃平均・地価・財政力指数は、県値を出すのに必要な重み（借家数・標準地数）や
//   概念（県の財政力指数は市町村の合成ではない）が無いため **収録しない**。
//   「中央値を県の値として見せる」ことはしない。
// - **合算が公表値を再現できることを確認できた指標だけを載せる。** これは
//   「公表値があるかどうか」ではなく「合算で再現できるか」が基準。市区町村集計に
//   調査対象外があると系統的にずれ、順位まで入れ替わることがある。
//   実例: 空き家率（住宅・土地統計調査）は市区町村集計が人口1.5万人未満の町村を
//   含まず、それが空き家率の高い過疎地に偏るため、合算すると徳島 21.24%・和歌山
//   21.17%（総務省公表）が 20.4%・20.7% となり **1位が逆転した**。カバレッジを
//   併記しても「1位は和歌山県」と表示される以上は誤りとして読まれるので収録しない。
//   復活させるなら住宅・土地統計調査の *都道府県表* の公表値を取得すること。
// - 各指標は集計方法（method）とカバレッジ（covered/total）を必ずページに出す。

import type { Municipality } from "./types";
import { PREFS } from "./prefs";
import { prefNameOf } from "./site";
import { formatAsOfJa } from "./format";
import { groupByPref, muniLevelOnly, POPULATION_FRESHNESS } from "./rankings";
import { hasAgeData } from "./ageStats";
import { hasForeignData } from "./foreignResidents";
import { hasChildcareCapacity } from "./childcare";
import { populationDensity, densityText } from "./populationDensity";

export type PrefRankingRow = {
  prefSlug: string;
  prefName: string;
  value: number;
  /** 合算に使えた自治体数（対象外・未収録を除く） */
  covered: number;
  /** 県内の市区町村数（政令市は親市で1件。muniLevelOnly 後の数） */
  total: number;
};

export type PrefRankingDef = {
  /** 対応する市区町村ランキングの slug。URL は /ranking/{slug}/prefecture */
  slug: string;
  /** H1 用のフレーズ */
  title: string;
  /** meta title 専用の言い換え（任意） */
  seoTitle?: string;
  /** パンくず・リンクラベル用の短い表記 */
  shortLabel: string;
  /** 値カラムの見出し */
  columnLabel: string;
  /** 既定の並び。desc=大きい順 */
  order: "asc" | "desc";
  /** 本文リード */
  lead: string;
  /** 集計方法の説明。honesty 方針でページに必ず表示する */
  method: string;
  /**
   * 合算に使える自治体か。**対象判定の単一ソース**で、カバレッジ（covered）の
   * 数え方でもある。buildPrefRankingRows がこの述語で絞ってから aggregate を呼ぶ。
   * 判定は lib/vacancy.hasVacancy 等の共有ヘルパーに委譲し、ここで再実装しない。
   */
  counts: (m: Municipality) => boolean;
  /**
   * 県の値を算出する。**counts で絞り込み済みの配列**が渡るので、ここで対象判定を
   * 再度書かないこと（二重定義は covered と合計がずれる原因になる）。
   * 空配列で呼ばれることはない（呼び出し側が弾く）。
   */
  aggregate: (munis: Municipality[]) => number | null;
  /** 値の表示テキスト */
  display: (value: number) => string;
  /** 出典テキスト（実データの source / asOf から導出。無ければ null） */
  sourceOf: (munis: Municipality[]) => string | null;
  faq?: { q: string; a: string }[];
};

// ---- 集計の小道具 ----

/**
 * 分子・分母をそれぞれ合算して百分率にする（率の平均ではなく実数の比）。
 * 対象判定は済んでいる前提（PrefRankingDef.counts を参照）。
 */
function ratioPct(
  munis: Municipality[],
  numer: (m: Municipality) => number,
  denom: (m: Municipality) => number,
): number | null {
  let n = 0;
  let d = 0;
  for (const m of munis) {
    n += numer(m);
    d += denom(m);
  }
  return d > 0 ? (n / d) * 100 : null;
}

/** 最初に実データを持つ自治体から「出典（基準時点）」の表記を組み立てる。 */
function sourceFrom(
  munis: Municipality[],
  pick: (m: Municipality) => { source: string; asOf: string } | null,
): string | null {
  for (const m of munis) {
    const s = pick(m);
    if (s) return `${s.source}（${formatAsOfJa(s.asOf)}）`;
  }
  return null;
}

// ---- 定義 ----

export const PREF_RANKINGS: PrefRankingDef[] = [
  {
    slug: "population-most",
    title: "都道府県の人口ランキング",
    seoTitle: "都道府県別 人口ランキング",
    shortLabel: "都道府県の人口",
    columnLabel: "人口",
    order: "desc",
    lead: "都道府県ごとの人口を、県内の全市区町村の人口を合算して求めた順位です。",
    method: `県内の全市区町村の人口（${POPULATION_FRESHNESS}）を合算しています。`,
    counts: (m) => m.population > 0,
    aggregate: (munis) => munis.reduce((s, m) => s + m.population, 0),
    display: (v) => `${Math.round(v).toLocaleString()}人`,
    sourceOf: () => `${POPULATION_FRESHNESS}（総務省）`,
    faq: [
      {
        q: "この人口はいつ時点のものですか？",
        a: `${POPULATION_FRESHNESS}の値です。県内の全市区町村の人口を合算して算出しています（政令指定都市は市の値を1件として数え、行政区の重複計上はしていません）。`,
      },
    ],
  },
  {
    slug: "population-density",
    title: "都道府県の人口密度ランキング",
    seoTitle: "都道府県別 人口密度ランキング",
    shortLabel: "都道府県の人口密度",
    columnLabel: "人口密度",
    order: "desc",
    lead: "都道府県ごとの人口密度を、県内の市区町村の人口と面積をそれぞれ合算して求めた順位です。",
    method: `県内市区町村の人口（${POPULATION_FRESHNESS}）の合計を、面積（国土地理院「全国都道府県市区町村別面積調」）の合計で割って算出しています。市区町村ごとの密度を平均したものではありません。境界未定地域の扱いにより、都道府県として公表される面積とわずかに差が出る場合があります（順位には影響しません）。`,
    // 面積未収録・人口0の除外は populationDensity が持つ（市区町村ランキングの
    // qualifies と同じ式。ここで再実装しない）。
    counts: (m) => populationDensity(m) != null,
    aggregate: (munis) => {
      let pop = 0;
      let area = 0;
      for (const m of munis) {
        pop += m.population;
        area += m.areaKm2!;
      }
      return area > 0 ? pop / area : null;
    },
    display: densityText,
    sourceOf: () => `${POPULATION_FRESHNESS}・国土地理院「全国都道府県市区町村別面積調」`,
    faq: [
      {
        q: "市区町村ごとの人口密度を平均した値ですか？",
        a: "いいえ。人口の合計を面積の合計で割った、都道府県そのものの人口密度です。市区町村ごとの密度を平均すると小さな自治体が過大に効いてしまうため、実数を合算する方法をとっています。",
      },
    ],
  },
  {
    slug: "aging-high",
    title: "都道府県の高齢化率ランキング",
    seoTitle: "都道府県別 高齢化率ランキング",
    shortLabel: "都道府県の高齢化率",
    columnLabel: "高齢化率",
    order: "desc",
    lead: "都道府県ごとの高齢化率（65歳以上の割合）を、県内市区町村の実人数を合算して求めた順位です。",
    method:
      "県内市区町村の65歳以上人口の合計を、総人口の合計で割って算出しています（住民基本台帳・毎年1月1日時点、外国人住民を含む）。市区町村ごとの高齢化率を平均したものではありません。",
    counts: (m) => hasAgeData(m.ageStats),
    // 非null断定は counts（hasAgeData）が保証する。filter は要素型を絞らないため必要。
    aggregate: (munis) => ratioPct(munis, (m) => m.ageStats!.elderly, (m) => m.ageStats!.total),
    display: (v) => `${v.toFixed(1)}%`,
    sourceOf: (munis) =>
      sourceFrom(munis, (m) => (hasAgeData(m.ageStats) ? m.ageStats : null)),
    faq: [
      {
        q: "高齢化率はどう計算していますか？",
        a: "65歳以上人口 ÷ 総人口 × 100 です。都道府県の値は、県内市区町村の実人数をそれぞれ合算してから割っています（率の平均ではありません）。出典は総務省「住民基本台帳に基づく人口・世帯数調査」で、外国人住民を含む総計です。",
      },
    ],
  },
  {
    slug: "foreign-ratio-high",
    title: "都道府県の外国人住民比率ランキング",
    seoTitle: "都道府県別 外国人住民比率ランキング",
    shortLabel: "都道府県の外国人比率",
    columnLabel: "外国人住民比率",
    order: "desc",
    lead: "都道府県ごとの外国人住民の割合を、県内市区町村の実人数を合算して求めた順位です。",
    method:
      `県内市区町村の在留外国人数の合計を、人口の合計で割って算出しています（出入国在留管理庁「在留外国人統計」÷ ${POPULATION_FRESHNESS}人口）。比率の高い低いという事実を示すもので、住みやすさ等の価値判断とは無関係です。`,
    counts: (m) => hasForeignData(m.foreignResidents.source) && m.population > 0,
    aggregate: (munis) => ratioPct(munis, (m) => m.foreignResidents.value, (m) => m.population),
    display: (v) => `${v.toFixed(2)}%`,
    sourceOf: (munis) =>
      sourceFrom(munis, (m) =>
        hasForeignData(m.foreignResidents.source) ? m.foreignResidents : null,
      ),
    faq: [
      {
        q: "この比率は何を表していますか？",
        a: "在留外国人数 ÷ 人口 × 100 です。多様性・国際性の目安であり、住みやすさや治安といった価値判断とは無関係です。都道府県の値は県内市区町村の実人数を合算して算出しています。",
      },
    ],
  },
  {
    slug: "childcare-capacity",
    title: "都道府県の保育定員余裕率ランキング",
    seoTitle: "都道府県別 保育所の定員余裕率ランキング",
    shortLabel: "都道府県の保育定員余裕率",
    columnLabel: "定員余裕率",
    order: "desc",
    lead: "都道府県ごとの保育所等の定員の余裕を、県内市区町村の定員と利用児童数を合算して求めた順位です。",
    method:
      "（県内の定員合計 − 利用児童数合計）÷ 定員合計 × 100 で算出しています（こども家庭庁「保育所等関連状況取りまとめ」）。負の値は定員の弾力運用（定員を超えた受け入れ）を示す実データです。政令指定都市は市単位の集計値のため、市を1件として数えています。",
    counts: (m) => hasChildcareCapacity(m.childcare),
    // 非null断定は counts（hasChildcareCapacity）が保証する。
    aggregate: (munis) => {
      let capacity = 0;
      let enrolled = 0;
      for (const m of munis) {
        capacity += m.childcare!.capacity;
        enrolled += m.childcare!.enrolled;
      }
      return capacity > 0 ? ((capacity - enrolled) / capacity) * 100 : null;
    },
    display: (v) => `${v.toFixed(1)}%`,
    sourceOf: (munis) =>
      sourceFrom(munis, (m) => (hasChildcareCapacity(m.childcare) ? m.childcare! : null)),
    faq: [
      {
        q: "定員余裕率が高いと入園しやすいということですか？",
        a: "県全体としての空き具合の目安にはなりますが、保育所の空きは市区町村ごと・年齢ごとに大きく違います。実際の保活では市区町村単位の値と0歳児・1〜2歳児の内訳を確認してください。",
      },
    ],
  },
];

export function getPrefRankingBySlug(slug: string): PrefRankingDef | null {
  return PREF_RANKINGS.find((r) => r.slug === slug) ?? null;
}

/** ある指標の slug に都道府県版があるか（市区町村ランキング側から導線を出すのに使う）。 */
export function hasPrefRanking(slug: string): boolean {
  return PREF_RANKINGS.some((r) => r.slug === slug);
}

/**
 * 全自治体から、その指標の都道府県ランキング行を組み立てる。
 * 並びは def.order（値が同じ場合は都道府県コード順＝PREFS の並び）。
 * 値が算出できない都道府県は行ごと落とす（0 として並べない＝honesty）。
 */
export function buildPrefRankingRows(
  def: PrefRankingDef,
  all: Municipality[],
): PrefRankingRow[] {
  const byPref = groupByPref(muniLevelOnly(all));
  const rows: PrefRankingRow[] = [];
  // PREFS の順に見ることで、同値のときの並びが実行ごとにぶれない。
  for (const p of PREFS) {
    const list = byPref.get(p.slug);
    if (!list || list.length === 0) continue;
    // 対象判定はここで1回だけ行い、絞り込んだ配列を aggregate へ渡す。
    // covered は「合算に実際に使った件数」そのものになるので、合計とカバレッジが
    // 定義上ずれ得ない（両者が別々に述語を持っていた頃の drift を構造的に潰す）。
    const eligible = list.filter(def.counts);
    if (eligible.length === 0) continue;
    const value = def.aggregate(eligible);
    if (value == null) continue;
    rows.push({
      prefSlug: p.slug,
      prefName: prefNameOf(p.slug),
      value,
      covered: eligible.length,
      total: list.length,
    });
  }
  rows.sort((a, b) => (def.order === "desc" ? b.value - a.value : a.value - b.value));
  return rows;
}

const cache = new Map<string, PrefRankingRow[]>();

/** 都道府県ランキング行を返す（初回のみ構築してキャッシュ。prefAggregates と同方針）。 */
export async function getPrefRankingRows(def: PrefRankingDef): Promise<PrefRankingRow[]> {
  const hit = cache.get(def.slug);
  if (hit) return hit;
  const { listAllAcrossPrefs } = await import("./metrics");
  const rows = buildPrefRankingRows(def, await listAllAcrossPrefs());
  cache.set(def.slug, rows);
  return rows;
}
