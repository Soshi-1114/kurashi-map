// 全国ランキングページのデータ駆動定義。地図指標(mapMetrics)や県集計(prefStats)と
// 同じく「指標の定義を1か所に集約し、ページは定義から描画する」方針。
//
// 対象は market-level の1自治体＝1エントリにするため、政令市の行政区(level:"ward")は
// 除外して親市との重複を避ける。東京23特別区は tokyo.json 上 level:"muni" なので含まれる。

import type { Municipality } from "./types";
import { hasRent } from "./rentColor";
import { hasLandPrice } from "./landPrice";
import { isWaitlistDisclosed } from "./waitlist";
import { hasForeignData, foreignRatioPct } from "./foreignResidents";
import { hasVacancy, vacancyRateText } from "./vacancy";
import { populationDensity, densityText } from "./populationDensity";
import { prefNameOf } from "./site";

/** トップページ等でランキング導線をまとめるカテゴリ（URL・ページ内容には影響しない） */
export type RankingCategory = "住まい" | "人口・まち" | "子育て・生活";

export type RankingDef = {
  slug: string;
  /** ナビゲーションのグルーピング用カテゴリ */
  category: RankingCategory;
  /** ページ H1 / 見出し用のフレーズ */
  title: string;
  /**
   * meta title 専用の言い換え（任意）。検索クエリの語彙（例:「家賃相場」）に合わせる。
   * H1・リンクラベル・構造化データは title のままにし、title タグだけ差し替える。
   * 背景: GSC で「埼玉 相場」「家賃相場 岡山市」等が多数表示・0クリック（2026-07 分析）。
   */
  seoTitle?: string;
  /** ランキング一覧・パンくず用の短いラベル */
  shortLabel: string;
  /** meta description のひな型（{top1} を1位自治体名に置換） */
  description: string;
  /**
   * description で表現しきれない動的な meta description を、1位自治体（null=該当なし）
   * から実データで組み立てる任意フック。指定時は description より優先する。
   */
  metaDescription?: (top1: Municipality | null) => string;
  /** 本文リード */
  lead: string;
  /** リード直後に添える中立的な注記（データの位置づけなど。任意） */
  note?: string;
  /**
   * ロングテール薄ページ対策の導入文（段落配列。各 {top1} を1位自治体名に置換）。
   * 上位・下位の傾向を中立的に解説し、検索意図に応えるリッチなテキストを置く。
   */
  intro?: string[];
  /** ランキング固有のFAQ（可視テキストと FAQPage 構造化データで同一ソースを共有）。 */
  faq?: { q: string; a: string }[];
  /** 県別ページの導入文（県名を差し込む。薄ページ対策＋ロングテール「{県} 外国人 割合」）。 */
  prefIntro?: (prefName: string) => string[];
  /** 県別ページで全国平均・県平均の外国人住民比率ベンチマークを表示するか。 */
  compareForeignAvg?: boolean;
  /**
   * H1/見出しに添える鮮度ラベルを1位自治体（=データ asOf）から導出する任意フック。
   * 例: 「2024年12月最新」。指定が無い／null の場合は既定の「全国」を使う。
   */
  freshnessLabel?: (top1: Municipality | null) => string | null;
  /**
   * 出典の次回更新予定（判明しているもののみ）。「次回更新予定: 」に続く文として
   * H1 直下に表示し、データ鮮度への不安に応える。出典の公表→データ反映のたびに
   * この文言も次の期へ手動更新する（docs/data-update.md 参照）。
   */
  nextUpdate?: string;
  /**
   * 「該当自治体の一覧」型ランキング（例: 待機児童ゼロ）。値の分布ではないため、
   * 県別ページの中央値サマリー（データ概況）を持たない。ページ側は slug を直接
   * 比較せず、このフラグで分岐する（compareForeignAvg と同じ capability 方式）。
   */
  membershipList?: boolean;
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

// 家賃ランキングの注記。値が公表値そのものではなく階級中点による加重平均であることを
// 明示する（honesty 方針。算出方法は /about#calc に集約）。
const RENT_NOTE =
  "家賃は住宅・土地統計調査の「家賃階級別の借家数」から、各階級の中点で加重平均して求めた民営借家の平均です（中央値ではありません）。同調査の集計対象外となる小規模町村はランキングに含みません。";

// 外国人住民比率ランキングの中立フレーミング注記（データの位置づけ）。
const FOREIGN_NOTE =
  "外国人住民比率は多様性・国際性の目安です（出典: 出入国在留管理庁「在留外国人統計」）。比率の高い／低いという事実を示すもので、住みやすさ等の価値判断とは無関係です。";

// "2024-12"・"2025-04-01" → "2024年12月"・"2025年4月"。データ asOf を見出し・出典表示の
// 鮮度ラベルへ整形する（日付は月に丸める）。整形できない形式（和暦・複合ラベル等）はそのまま返す。
export function formatAsOfJa(asOf: string): string {
  const m = /^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/.exec(asOf ?? "");
  if (m) return `${m[1]}年${Number(m[2])}月`;
  const y = /^(\d{4})$/.exec(asOf ?? "");
  if (y) return `${y[1]}年`;
  return asOf ?? "";
}

// 指標の asOf から H1 用の鮮度ラベル（例「2025年6月最新」）を導出する汎用フック。
function freshnessFromAsOf(getAsOf: (m: Municipality) => string) {
  return (top1: Municipality | null): string | null =>
    top1 ? `${formatAsOfJa(getAsOf(top1))}最新` : null;
}
const foreignFreshnessLabel = freshnessFromAsOf((m) => m.foreignResidents.asOf);

// 人口の鮮度ラベル。Municipality に人口の asOf フィールドが無いため固定文字列とし、
// 確定値公表・次回調査での更新時に NEXT_UPDATE.population と合わせて書き換える。
const POPULATION_FRESHNESS = "2025年国勢調査";

// 外国人住民比率ランキングの導入文（薄ページ対策・中立フレーミング）。high/low で傾向解説を分岐。
function foreignIntro(highLow: "高い" | "低い"): string[] {
  const trend =
    highLow === "高い"
      ? "上位には、製造業の集積地や大学・技能実習の受け入れが多い地域、観光・サービス業の盛んな自治体が並ぶ傾向があります。比率が高い地域は、外国語対応や多文化共生の取り組みが進んでいる場合があります。"
      : "下位には、人口規模の小さい町村や、外国人の就労・居住の拠点が少ない地域が並ぶ傾向があります。比率が低いことは、その地域の特性を示す事実であり、優劣を意味するものではありません。";
  return [
    `このページは、全国の市区町村を人口に占める外国人住民の割合（在留外国人数 ÷ 人口）が${highLow}順に並べたランキングです。各順位の自治体名から、その地域の在留外国人数・人口・人口推移などの住環境データを地図とあわせて確認できます。`,
    `${trend}外国人住民比率は地域の多様性・国際性を読み解く客観的な指標のひとつで、住みやすさ等の価値判断とは切り離して中立的にご覧ください。`,
    "数値は出入国在留管理庁「在留外国人統計」と国勢調査人口の実データから算出しており、推計値は含みません。政令指定都市の行政区は親市との重複を避けるため集計から除外しています。",
  ];
}

// 県別ページの導入文（「{県} 外国人 割合」「{県} 市町村 外国人 多い」を狙う）。
function foreignPrefIntro(highLow: "高い" | "低い") {
  return (prefName: string): string[] => {
    const trend =
      highLow === "高い"
        ? "上位の自治体ほど、人口に占める外国人住民の割合が高い地域です。"
        : "上位（＝割合が低い順）の自治体ほど、人口に占める外国人住民の割合が低い地域です。";
    return [
      `このページは、${prefName}内の市区町村を人口に占める外国人住民の割合が${highLow}順に並べたランキングです。${trend}各自治体名から、在留外国人数・人口・人口推移などの住環境データを地図とあわせて確認できます。`,
      `${prefName}全体の平均（県平均）や全国平均と比べてどの程度かを下のベンチマークで確認できます。外国人住民比率は地域の多様性・国際性を読み解く客観的な指標で、住みやすさ等の価値判断とは無関係です。数値は出入国在留管理庁「在留外国人統計」と国勢調査人口の実データで、推計値は含みません。`,
    ];
  };
}

// 外国人住民比率ランキング共通のFAQ（FAQPage 構造化データ＋可視テキスト）。
const FOREIGN_FAQ: { q: string; a: string }[] = [
  {
    q: "外国人住民比率とは何ですか？",
    a: "その市区町村に住む外国人住民の数を、総人口で割った割合（%）です。本サイトでは出入国在留管理庁「在留外国人統計」の在留外国人数と、国勢調査の人口から算出しています。",
  },
  {
    q: "データの出典と基準時点は？",
    a: "在留外国人数は出入国在留管理庁「在留外国人統計」（e-Stat 経由）、人口は国勢調査の公表値です。いずれも政府統計の実データで、推計値や補完値は使用していません。在留外国人統計は年2回（6月末・12月末時点）公表され、本サイトは公表のたびに最新データへ更新しています。",
  },
  {
    q: "外国人住民比率が高い・低いことに良し悪しはありますか？",
    a: "ありません。比率は地域の多様性・国際性を読み解く客観的な指標のひとつであり、住みやすさや治安などの価値判断とは無関係です。本サイトは事実として中立に提示しています。",
  },
  {
    q: "政令指定都市の区はどう扱っていますか？",
    a: "親市との重複を避けるため、政令指定都市の行政区はランキングの集計対象から除外しています。東京23特別区は市区町村単位で集計対象に含めています。",
  },
];

// 各出典の次回更新予定（公表サイクルは docs/data-update.md §5 参照）。
// 出典の公表→データ反映のたびに次の期へ書き換える。地図ハブ等でも参照するため export。
export const NEXT_UPDATE = {
  rent: "出典（住宅・土地統計調査）は5年周期のため、現在の2023年調査が最新の公表データです。次回は2028年調査（結果公表は2029年以降）の見込みです。",
  landPrice: "地価公示は毎年3月公表です。次回（2027年地価公示）の公表後に更新予定です。",
  waitlist: "こども家庭庁の次回取りまとめ（2026年4月1日時点）は例年8月末〜9月に公表され、公表後に更新予定です。",
  population: "令和7年（2025年）国勢調査の確定値（人口等基本集計）が2026年9月までに公表予定で、公表後に更新予定です。",
  foreign: "在留外国人統計は年2回公表です。次回は2026年6月末時点の市区町村別データが2026年12月中旬に公表見込みで、公表後すみやかに更新予定です。",
  vacancy:
    "出典（住宅・土地統計調査）は5年周期のため、現在の2023年調査が最新の公表データです。次回は2028年調査（結果公表は2029年以降）の見込みです。",
} as const;

// 空き家率の鮮度ラベル。asOf 由来の「2023年最新」は誤解を招くため、調査名を明示する固定文字列。
const VACANCY_FRESHNESS = "2023年住宅・土地統計調査";

// 空き家率ランキングの導入文（薄ページ対策）。high/low で傾向解説を分岐。
function vacancyIntro(highLow: "高い" | "低い"): string[] {
  const trend =
    highLow === "高い"
      ? "上位には、別荘など二次的住宅が多いリゾート地（軽井沢町・熱海市など）と、人口減少により利用されない住宅が増えている地方の自治体が並ぶ傾向があります。空き家率が高いことは、裏を返せば住宅ストックに余裕があり、安価な物件や空き家バンクの選択肢が見つかりやすい可能性も意味します。"
      : "下位（空き家率が低い側）には、人口流入が続く都市部やその近郊が並ぶ傾向があります。住宅需要が強く、賃貸・売買市場の回転が速い地域と読むことができます。";
  return [
    `このページは、全国の市区町村を空き家率（空き家数 ÷ 住宅総数）が${highLow}順に並べたランキングです。総務省「住宅・土地統計調査」（2023年）の実データのみで集計しており、2023年の全国の空き家率は13.8%と過去最高を更新しています。`,
    `${trend}各順位の自治体名から、その地域の家賃・地価・人口推移・災害リスクなどの住環境データを地図とあわせて確認できます。`,
    "空き家率は住宅ストックの状態を示す客観的な指標のひとつで、住みやすさ等の価値判断とは切り離して中立的にご覧ください。調査の市区町村集計は人口1.5万人未満の町村を含まないため、該当する町村はランキングの対象外です（推計値は使いません）。",
  ];
}

const VACANCY_FAQ: { q: string; a: string }[] = [
  {
    q: "空き家率はどうやって計算していますか？",
    a: "総務省「住宅・土地統計調査」（2023年）の市区町村別の空き家数を住宅総数で割った割合（%）です。総務省が公表する全国の空き家率（2023年 13.8%）と同じ定義で、賃貸用・売却用・二次的住宅を含む空き家全体を対象としています。",
  },
  {
    q: "掲載されていない町村があるのはなぜですか？",
    a: "住宅・土地統計調査の市区町村集計は、人口1.5万人未満の町村を対象としていないためです。本サイトは推計値を使わない方針のため、対象外の自治体は「データなし」として扱い、ランキングにも含めていません。",
  },
  {
    q: "データはいつ更新されますか？",
    a: "住宅・土地統計調査は5年周期で、現在の2023年調査が最新です。次回は2028年調査（公表は2029年以降）の見込みで、公表後すみやかに反映します。",
  },
];

// 人口・人口密度ランキングの meta description（1位の実数値を含む）。
// 2026-08 GSC分析: population-most 系は「{市} 人口」のような特定1市の人口を探す検索でも
// 上位表示されるが、一般的な description（{top1}名のみ）では「全国/県のランキング」に
// しか見えずクリックされにくい（例: 岡崎市 人口＝3位表示・impressions11・clicks0）。
// 都道府県別ページでは該当県の全市区町村を掲載していることを明記し、期待値を合わせる。
function populationMetaDescription(metric: "most" | "densityHigh" | "densityLow") {
  const noun = metric === "most" ? "人口" : "人口密度";
  const verb = metric === "densityLow" ? "低い" : metric === "densityHigh" ? "高い" : "多い";
  const valueOf = (m: Municipality) =>
    metric === "most" ? `${m.population.toLocaleString()}人` : densityText(populationDensity(m) ?? 0);
  return (top1: Municipality | null): string => {
    const head = `全国の市区町村を${noun}が${verb}順にランキング。`;
    const tail = `都道府県ごとのページでは、県内の全市区町村を${noun}順に掲載しています。`;
    if (!top1) return `${head}国勢調査の実データで比較できます。${tail}`;
    const name = `${prefNameOf(top1.pref)}${top1.displayName ?? top1.name}`;
    return `${head}最も${noun}が${verb}のは${name}（${valueOf(top1)}、${POPULATION_FRESHNESS}）。${tail}`;
  };
}

// 1位自治体（実データ）から「名前・比率・基準年」を含む meta description を組み立てる。
function foreignMetaDescription(highLow: "高い" | "低い") {
  return (top1: Municipality | null): string => {
    const head = `全国の市区町村を外国人住民比率が${highLow}順にランキング。`;
    if (!top1) return `${head}多様性・国際性の目安として、出入国在留管理庁「在留外国人統計」の実データで比較できます。`;
    const name = `${prefNameOf(top1.pref)}${top1.displayName ?? top1.name}`;
    const ratio = foreignRatioPct(top1).toFixed(2);
    // asOf は "2025-06" 形式なので、検索結果に出る文言として自然な「2025年6月」へ整形する。
    return `${head}${highLow === "高い" ? "最も比率が高い" : "最も比率が低い"}のは${name}（${ratio}%、${formatAsOfJa(top1.foreignResidents.asOf)}時点）。多様性・国際性の目安として、出入国在留管理庁「在留外国人統計」の実データで比較できます。`;
  };
}

export const RANKINGS: RankingDef[] = [
  {
    slug: "rent-cheap",
    category: "住まい",
    title: "家賃が安い市区町村ランキング",
    seoTitle: "家賃相場が安い市区町村ランキング",
    shortLabel: "家賃が安い",
    description:
      "全国の市区町村を民営借家の家賃平均が安い順にランキング。最も家賃が安いのは{top1}。家賃相場の低い自治体を政府統計（住宅・土地統計調査）の実データで比較できます。",
    lead: "全国の市区町村を民営借家の家賃平均が安い順に並べたランキングです。",
    note: RENT_NOTE,
    columnLabel: "家賃平均",
    order: "asc",
    nextUpdate: NEXT_UPDATE.rent,
    qualifies: (m) => hasRent(m.rent.value),
    sortValue: (m) => m.rent.value,
    display: (m) => `${m.rent.value.toLocaleString()}円/月`,
  },
  {
    slug: "rent-high",
    category: "住まい",
    title: "家賃が高い市区町村ランキング",
    seoTitle: "家賃相場が高い市区町村ランキング",
    shortLabel: "家賃が高い",
    description:
      "全国の市区町村を民営借家の家賃平均が高い順にランキング。最も家賃が高いのは{top1}。家賃相場の高い自治体を政府統計（住宅・土地統計調査）の実データで比較できます。",
    lead: "全国の市区町村を民営借家の家賃平均が高い順に並べたランキングです。",
    note: RENT_NOTE,
    columnLabel: "家賃平均",
    order: "desc",
    nextUpdate: NEXT_UPDATE.rent,
    qualifies: (m) => hasRent(m.rent.value),
    sortValue: (m) => m.rent.value,
    display: (m) => `${m.rent.value.toLocaleString()}円/月`,
  },
  {
    slug: "vacancy-high",
    category: "住まい",
    title: "空き家率が高い市区町村ランキング",
    shortLabel: "空き家率が高い",
    description:
      "全国の市区町村を空き家率が高い順にランキング。最も空き家率が高いのは{top1}。住宅・土地統計調査（2023年）の実データで空き家の多い自治体を比較できます。",
    lead: "全国の市区町村を、空き家率（空き家数 ÷ 住宅総数）が高い順に並べたランキングです（住宅・土地統計調査 2023年）。",
    intro: vacancyIntro("高い"),
    faq: VACANCY_FAQ,
    columnLabel: "空き家率",
    order: "desc",
    freshnessLabel: () => VACANCY_FRESHNESS,
    nextUpdate: NEXT_UPDATE.vacancy,
    qualifies: (m) => hasVacancy(m.vacancy),
    sortValue: (m) => m.vacancy?.rate ?? 0,
    display: (m) => (hasVacancy(m.vacancy) ? vacancyRateText(m.vacancy) : "—"),
  },
  {
    slug: "vacancy-low",
    category: "住まい",
    title: "空き家率が低い市区町村ランキング",
    shortLabel: "空き家率が低い",
    description:
      "全国の市区町村を空き家率が低い順にランキング。最も空き家率が低いのは{top1}。住宅需要が強い自治体を住宅・土地統計調査（2023年）の実データで比較できます。",
    lead: "全国の市区町村を、空き家率（空き家数 ÷ 住宅総数）が低い順に並べたランキングです（住宅・土地統計調査 2023年）。",
    intro: vacancyIntro("低い"),
    faq: VACANCY_FAQ,
    columnLabel: "空き家率",
    order: "asc",
    freshnessLabel: () => VACANCY_FRESHNESS,
    nextUpdate: NEXT_UPDATE.vacancy,
    qualifies: (m) => hasVacancy(m.vacancy),
    sortValue: (m) => m.vacancy?.rate ?? 0,
    display: (m) => (hasVacancy(m.vacancy) ? vacancyRateText(m.vacancy) : "—"),
  },
  {
    slug: "land-price-high",
    category: "住まい",
    title: "地価が高い市区町村ランキング",
    shortLabel: "地価が高い",
    description:
      "全国の市区町村を住宅地の地価が高い順にランキング。最も地価が高いのは{top1}。地価公示・地価調査の実データで自治体を比較できます。",
    lead: "全国の市区町村を住宅地の地価（円/㎡）が高い順に並べたランキングです。",
    columnLabel: "地価（住宅地）",
    order: "desc",
    freshnessLabel: freshnessFromAsOf((m) => m.landPrice.asOf),
    nextUpdate: NEXT_UPDATE.landPrice,
    qualifies: (m) => hasLandPrice(m.landPrice.value),
    sortValue: (m) => m.landPrice.value,
    display: (m) => `${m.landPrice.value.toLocaleString()}円/㎡`,
  },
  {
    slug: "land-price-low",
    category: "住まい",
    title: "地価が安い市区町村ランキング",
    shortLabel: "地価が安い",
    description:
      "全国の市区町村を住宅地の地価が安い順にランキング。最も地価が安いのは{top1}。地価公示・地価調査の実データで、土地が手頃な自治体を比較できます。",
    lead: "全国の市区町村を住宅地の地価（円/㎡）が安い順に並べたランキングです。",
    columnLabel: "地価（住宅地）",
    order: "asc",
    freshnessLabel: freshnessFromAsOf((m) => m.landPrice.asOf),
    nextUpdate: NEXT_UPDATE.landPrice,
    qualifies: (m) => hasLandPrice(m.landPrice.value),
    sortValue: (m) => m.landPrice.value,
    display: (m) => `${m.landPrice.value.toLocaleString()}円/㎡`,
  },
  {
    slug: "waitlist-zero",
    category: "子育て・生活",
    title: "待機児童ゼロの市区町村",
    shortLabel: "待機児童ゼロ",
    description:
      "待機児童ゼロの市区町村を人口が多い順に掲載。{top1}など、子育て世帯が注目する待機児童ゼロの自治体をこども家庭庁の公表値で確認できます。",
    lead: "待機児童数が0人の市区町村を、人口が多い順に掲載しています（こども家庭庁の公表値）。",
    note: "これは順位表ではありません。待機児童ゼロは全国で多数の自治体が該当するため（対象自治体の約9割）、掲載順は待機児童の少なさではなく人口の多い順です。保育の入りやすさは年齢・地域・時期によって差があるため、詳しくは各自治体の公表資料をご確認ください。",
    membershipList: true,
    columnLabel: "人口",
    order: "desc",
    freshnessLabel: freshnessFromAsOf((m) => m.waitlistChildren.asOf),
    nextUpdate: NEXT_UPDATE.waitlist,
    qualifies: (m) => isWaitlistDisclosed(m.waitlistChildren) && m.waitlistChildren.value === 0,
    sortValue: (m) => m.population,
    display: (m) => `${m.population.toLocaleString()}人`,
  },
  {
    slug: "population-most",
    category: "人口・まち",
    title: "人口が多い市区町村ランキング",
    shortLabel: "人口が多い",
    description:
      "全国の市区町村を人口が多い順にランキング。最も人口が多いのは{top1}。国勢調査の人口（実データ）で自治体規模を比較できます。",
    metaDescription: populationMetaDescription("most"),
    lead: "全国の市区町村を、人口が多い順に並べたランキングです（国勢調査）。",
    columnLabel: "人口",
    order: "desc",
    freshnessLabel: () => POPULATION_FRESHNESS,
    nextUpdate: NEXT_UPDATE.population,
    qualifies: (m) => m.population > 0,
    sortValue: (m) => m.population,
    display: (m) => `${m.population.toLocaleString()}人`,
  },
  {
    slug: "population-density",
    category: "人口・まち",
    title: "人口密度が高い市区町村ランキング",
    shortLabel: "人口密度が高い",
    description:
      "全国の市区町村を人口密度（人/km²）が高い順にランキング。最も人口密度が高いのは{top1}。国勢調査人口と国土地理院の面積データで比較できます。",
    metaDescription: populationMetaDescription("densityHigh"),
    lead: "全国の市区町村を、人口密度（人口 ÷ 面積、人/km²）が高い順に並べたランキングです。",
    note: "人口は2025年国勢調査（速報）、面積は国土地理院「全国都道府県市区町村別面積調」に基づきます。境界未定部を持つ自治体の面積は国土地理院公表の参考値です。",
    columnLabel: "人口密度",
    order: "desc",
    freshnessLabel: () => POPULATION_FRESHNESS,
    nextUpdate: NEXT_UPDATE.population,
    qualifies: (m) => populationDensity(m) != null,
    sortValue: (m) => populationDensity(m) ?? 0,
    display: (m) => {
      const d = populationDensity(m);
      return d == null ? "—" : densityText(d);
    },
  },
  {
    slug: "population-density-low",
    category: "人口・まち",
    title: "人口密度が低い市区町村ランキング",
    shortLabel: "人口密度が低い",
    description:
      "全国の市区町村を人口密度（人/km²）が低い順にランキング。最も人口密度が低いのは{top1}。国勢調査人口と国土地理院の面積データで比較できます。",
    metaDescription: populationMetaDescription("densityLow"),
    lead: "全国の市区町村を、人口密度（人口 ÷ 面積、人/km²）が低い順に並べたランキングです。",
    note: "人口は2025年国勢調査（速報）、面積は国土地理院「全国都道府県市区町村別面積調」に基づきます。境界未定部を持つ自治体の面積は国土地理院公表の参考値です。",
    columnLabel: "人口密度",
    order: "asc",
    freshnessLabel: () => POPULATION_FRESHNESS,
    nextUpdate: NEXT_UPDATE.population,
    qualifies: (m) => populationDensity(m) != null,
    sortValue: (m) => populationDensity(m) ?? 0,
    display: (m) => {
      const d = populationDensity(m);
      return d == null ? "—" : densityText(d);
    },
  },
  {
    slug: "population-growth",
    category: "人口・まち",
    title: "人口増加率が高い市区町村ランキング",
    shortLabel: "人口増加率",
    description:
      "全国の市区町村を5年間（2020→2025年国勢調査）の人口増減率が高い順にランキング。最も人口増加率が高いのは{top1}。国勢調査の実データで人口が増えている自治体を比較できます。",
    lead: "全国の市区町村を、5年間（2020→2025年国勢調査）の人口増減率が高い順に並べたランキングです。",
    note: "人口増減率は2020年と2025年の国勢調査人口の比較（%）で、転入・出生などの内訳は含みません。人口規模が小さい自治体や、震災からの帰還が進む自治体（福島県大熊町など）では率が大きく出ることがあります。",
    columnLabel: "人口増減率（2020→2025）",
    order: "desc",
    freshnessLabel: () => POPULATION_FRESHNESS,
    nextUpdate: NEXT_UPDATE.population,
    qualifies: (m) => typeof m.populationChangeRate === "number" && m.population > 0,
    sortValue: (m) => m.populationChangeRate ?? 0,
    display: (m) => {
      const r = m.populationChangeRate ?? 0;
      return `${r > 0 ? "+" : ""}${r.toFixed(1)}%`;
    },
  },
  {
    slug: "population-decline",
    category: "人口・まち",
    title: "人口減少率が高い市区町村ランキング",
    shortLabel: "人口減少率",
    description:
      "全国の市区町村を5年間（2020→2025年国勢調査）の人口減少率が高い順にランキング。最も人口が減っているのは{top1}。国勢調査の実データで人口が減っている自治体を比較できます。",
    lead: "全国の市区町村を、5年間（2020→2025年国勢調査）の人口減少率が大きい順に並べたランキングです。",
    note: "人口増減率は2020年と2025年の国勢調査人口の比較（%）で、転出・自然減などの内訳は含みません。人口規模が小さい自治体や、原発事故の避難区域を抱える自治体（福島県双葉町など）では減少率が大きく出ることがあります。人口が増えている自治体は表の下位（増加側）に並びます。",
    columnLabel: "人口増減率（2020→2025）",
    order: "asc",
    freshnessLabel: () => POPULATION_FRESHNESS,
    nextUpdate: NEXT_UPDATE.population,
    qualifies: (m) => typeof m.populationChangeRate === "number" && m.population > 0,
    sortValue: (m) => m.populationChangeRate ?? 0,
    display: (m) => {
      const r = m.populationChangeRate ?? 0;
      return `${r > 0 ? "+" : ""}${r.toFixed(1)}%`;
    },
  },
  {
    slug: "foreign-ratio-high",
    category: "人口・まち",
    title: "外国人住民比率が高い市区町村ランキング",
    shortLabel: "外国人比率が高い",
    description:
      "全国の市区町村を外国人住民比率が高い順にランキング。多様性・国際性の目安として、出入国在留管理庁「在留外国人統計」の実データで比較できます。",
    metaDescription: foreignMetaDescription("高い"),
    lead: "全国の市区町村を、人口に占める外国人住民の割合が高い順に並べたランキングです。",
    note: FOREIGN_NOTE,
    intro: foreignIntro("高い"),
    faq: FOREIGN_FAQ,
    prefIntro: foreignPrefIntro("高い"),
    compareForeignAvg: true,
    freshnessLabel: foreignFreshnessLabel,
    nextUpdate: NEXT_UPDATE.foreign,
    columnLabel: "外国人住民比率",
    order: "desc",
    // 在留外国人統計の対象かつ人口が有効（比率を算出できる）自治体のみ。
    qualifies: (m) => hasForeignData(m.foreignResidents.source) && m.population > 0,
    sortValue: (m) => foreignRatioPct(m),
    display: (m) => `${foreignRatioPct(m).toFixed(2)}%`,
  },
  {
    slug: "foreign-ratio-low",
    category: "人口・まち",
    title: "外国人住民比率が低い市区町村ランキング",
    shortLabel: "外国人比率が低い",
    description:
      "全国の市区町村を外国人住民比率が低い順にランキング。多様性・国際性の目安として、出入国在留管理庁「在留外国人統計」の実データで比較できます。",
    metaDescription: foreignMetaDescription("低い"),
    lead: "全国の市区町村を、人口に占める外国人住民の割合が低い順に並べたランキングです。",
    note: FOREIGN_NOTE,
    intro: foreignIntro("低い"),
    faq: FOREIGN_FAQ,
    prefIntro: foreignPrefIntro("低い"),
    compareForeignAvg: true,
    freshnessLabel: foreignFreshnessLabel,
    nextUpdate: NEXT_UPDATE.foreign,
    columnLabel: "外国人住民比率",
    order: "asc",
    qualifies: (m) => hasForeignData(m.foreignResidents.source) && m.population > 0,
    sortValue: (m) => foreignRatioPct(m),
    display: (m) => `${foreignRatioPct(m).toFixed(2)}%`,
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

/** 整列済みランキングの中央値に当たる自治体を返す（値の整形に def.display を使い回すため、値でなく自治体を返す）。 */
export function medianOf(ranked: Municipality[]): Municipality {
  return ranked[Math.floor((ranked.length - 1) / 2)];
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
