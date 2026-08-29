// 全国ランキングページのデータ駆動定義。地図指標(mapMetrics)や県集計(prefStats)と
// 同じく「指標の定義を1か所に集約し、ページは定義から描画する」方針。
//
// 対象は market-level の1自治体＝1エントリにするため、政令市の行政区(level:"ward")は
// 除外して親市との重複を避ける。東京23特別区は tokyo.json 上 level:"muni" なので含まれる。

import type { Municipality } from "./types";
import { hasRent } from "./rentColor";
import { hasLandPrice } from "./landPrice";
import { isWaitlistDisclosed } from "./waitlist";
import { isAmenitiesCounted } from "./coverage";
import { formatAsOfJa } from "./format";
import { hasForeignData, foreignRatioPct } from "./foreignResidents";
import { hasVacancy, vacancyRateText } from "./vacancy";
import { hasChildcareCapacity, childcareOpenRatioPct, childcareOpenRatioText } from "./childcare";
import { populationDensity, densityText } from "./populationDensity";
import { hasFuturePopulation, futureChangeRate2050, futureRateText } from "./futurePopulation";
import { prefNameOf } from "./site";
import { latestAsOf } from "./dataFreshness";

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
  /**
   * meta title の末尾に「｜」区切りで添える答えフレーズ（例:「日本一は横浜市」）を
   * 1位自治体から組み立てる任意フック。「日本の市として人口が最も多いのはどこ」のような
   * 質問型クエリに title で即答する用途（2026-08 GSC分析: population-most で同クエリが
   * 305imp/0click）。seoTitle と同じく title タグ専用で、H1・構造化データには使わない。
   */
  seoTitleAnswer?: (top1: Municipality) => string;
  /**
   * 県別ページの meta title 用の言い換え（任意）。「{県}の◯◯」の◯◯部分に入る。
   * 検索クエリの連続語（例:「人口ランキング」）を title に作るのが目的
   * （2026-08 GSC分析:「兵庫県 市町村 人口ランキング」等に対し既定 title は
   * 「人口が多い市区町村ランキング」で連続語を含まず CTR 0〜1.8%）。
   */
  prefSeoTitle?: string;
  /**
   * 関連ランキングへの導線（任意）。全国版・県別版のヒーロー action ボタンとして表示する。
   * リンク先が新規ページ群のとき、検索流入の強いページからの内部リンクで
   * インデックス・順位の立ち上がりを助ける用途（2026-08 GSC分析: future-population 系が
   * 2ページ目に滞留）。県別版はリンク先の県別ページにデータがある場合のみ表示。
   */
  related?: { slug: string; label: string };
  /**
   * 対応する指標別地図ハブ（/map/*）の href（任意）。ランキングページ（全国・県別）の
   * 「地図で見る」CTA がここから MAP_HUBS のラベルを引いて表示する。対応ハブが無い指標
   * （population-most・vacancy 等）は未設定にし、CTA 自体を出さない。
   */
  mapHub?: string;
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
  /**
   * 県ハブ（/area/{pref}）の「データ概況」表に出す指標（ラベルは columnLabel を使う）。
   * 表裏のある指標（家賃が安い/高い 等）は同じ値の並べ替え違いなので "高い順"（order:
   * "desc"）の側だけに付ける。概況の順位は def.order ではなく sortValue の降順で決めるため、
   * 向きは常に「高い順」で揃う（membershipList と同じ capability 方式）。
   */
  prefSummary?: boolean;
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

// formatAsOfJa の実体は lib/format.ts（クライアントコンポーネントが本モジュールを
// import すると RANKINGS の生テキストごとバンドルされるため移設）。サーバー側の
// 既存呼び出し（多数）の互換のためここから再exportする。
export { formatAsOfJa };

// 指標の asOf から H1 用の鮮度ラベル（例「2025年6月最新」）を導出する汎用フック。
function freshnessFromAsOf(getAsOf: (m: Municipality) => string) {
  return (top1: Municipality | null): string | null =>
    top1 ? `${formatAsOfJa(getAsOf(top1))}最新` : null;
}
const foreignFreshnessLabel = freshnessFromAsOf((m) => m.foreignResidents.asOf);

// 人口の基準年。Municipality に人口の asOf フィールドが無いため固定値とし、確定値公表・
// 次回調査での更新時に NEXT_UPDATE.population と合わせて書き換える。POPULATION_FRESHNESS
// （表示文言）・freshnessPrefix の比較対象の両方をここから導出し、二重管理を避ける。
export const POPULATION_ASOF = "2025";

// 人口の鮮度ラベル。エリア詳細ページの将来人口カード（現在人口のラベル）も参照するため export。
export const POPULATION_FRESHNESS = `${formatAsOfJa(POPULATION_ASOF)}国勢調査`;

// 人口増減率の比較期間の表記（国勢調査の5年周期）。次回調査の反映時に1箇所で更新する。
export const CENSUS_PERIOD = "2020→2025年国勢調査";

// 将来推計人口の鮮度ラベル。asOf("2023")由来の「2023年最新」は誤解を招くため推計名を明示。
// 地図ハブ（/map/future-population）でも参照するため export。
export const FUTURE_FRESHNESS = "令和5(2023)年推計";

// 家賃・空き家の「調査名+年度」ラベル（asOf "2023" → 「2023年住宅・土地統計調査」）。
// 年度はデータの実 asOf から導出し、二重管理を避ける。
export function housingSurveyLabel(asOf: string): string {
  return `${formatAsOfJa(asOf)}住宅・土地統計調査`;
}

// 地価の「調査名+年度」ラベル。出典は地価公示（国）と地価調査（都道府県）の2系統が
// あり、source 文字列から調査名を判定する（honesty 方針: 実際の出典と年度を表示）。
export function landPriceSurveyLabel(source: string, asOf: string): string {
  const survey = source.includes("地価調査") ? "地価調査" : "地価公示";
  return `${formatAsOfJa(asOf)}${survey}`;
}

// description の末尾に鮮度ラベルを1文追記する（「…。2023年住宅・土地統計調査のデータ。」）。
// 重複防止: ラベル中の年（YYYY年）が description に既出、またはラベルの括弧書きを除いた
// 表記（例「令和5(2023)年推計」→「令和5年推計」）が既出の場合は追記しない。
export function appendFreshness(description: string, freshness: string | null): string {
  if (!freshness) return description;
  const year = /\d{4}年/.exec(freshness)?.[0];
  const plain = freshness.replace(/[（(][^）)]*[）)]/g, "");
  if ((year && description.includes(year)) || description.includes(plain)) return description;
  return `${description}${freshness}のデータ。`;
}

// description 冒頭に付ける「【2025年12月更新】」形式のバッジ。asOf が1つも無ければ空文字。
//
// 「〜年版」ではなく「〜更新」と表現する: ページ内の複数指標は基準時点がバラバラ
// （例: 人口2025年・家賃2023年・外国人2025年12月）なので、ページ全体がその年の
// データで揃っているかのような「版」表記は誤解を招く。「更新」は一部の指標が
// その時点で更新されたという事実だけを述べるので、この状況でも成り立つ。
//
// 呼び出し側は「その description の本文に実際に書く指標の asOf だけ」を渡すこと。
// 本文に出てこない指標（例: 自治体詳細で言及していない地価）を混ぜると、バッジの
// 年と本文の内容が食い違い、実際より新しく見せているという誤解を招く。
export function freshnessPrefix(asOfs: (string | null | undefined)[]): string {
  const latest = latestAsOf(asOfs);
  return latest ? `【${formatAsOfJa(latest)}更新】` : "";
}

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
  waitlist: "こども家庭庁の次回取りまとめ（2027年4月1日時点）は例年8月末〜9月に公表され、公表後に更新予定です。",
  childcare: "こども家庭庁の次回取りまとめ（2027年4月1日時点）は例年8月末〜9月に公表され、公表後に更新予定です。",
  population: "令和7年（2025年）国勢調査の確定値（人口等基本集計）が2026年9月までに公表予定で、公表後に更新予定です。",
  foreign: "在留外国人統計は年2回公表です。次回は2026年6月末時点の市区町村別データが2026年12月中旬に公表見込みで、公表後すみやかに更新予定です。",
  vacancy:
    "出典（住宅・土地統計調査）は5年周期のため、現在の2023年調査が最新の公表データです。次回は2028年調査（結果公表は2029年以降）の見込みです。",
  future:
    "地域別将来推計人口は約5年周期で改定されます。現在の令和5(2023)年推計が最新で、次回（2028年頃見込み）の公表後に更新予定です。",
  stations: "駅データ（国土数値情報 S12）は年度ごとに更新されます。新年度版の公表後に更新予定です。",
  medical: "医療施設調査は毎年10月1日時点で実施されます。市区町村別データの公表後に更新予定です。",
  preschools: "施設データは年度ごとに更新されます。新年度データの公表・反映後に更新予定です。",
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

// 将来推計人口ランキング（IPSS 令和5年推計）の共通注記。公的推計の位置づけと
// 対象外自治体の理由、基準の違いを中立に説明する（煽り表現は使わない方針）。
const FUTURE_NOTE =
  "将来推計人口は国立社会保障・人口問題研究所（IPSS）の令和5(2023)年推計の公表値で、2020年国勢調査を基準としています。一定の仮定に基づく公的推計であり、将来を保証するものではありません。福島県浜通りの13市町村（浜通り地域として一括推計）・北方領土・浜松市中央区/浜名区（2024年の区再編前の旧区単位で推計）は市区町村別の推計がないため対象外です。";

const FUTURE_FAQ: { q: string; a: string }[] = [
  {
    q: "将来推計人口とは何ですか？",
    a: "国立社会保障・人口問題研究所（IPSS）が公表する「日本の地域別将来推計人口」（令和5(2023)年推計）の市区町村別の値です。2020年国勢調査を基準に、出生・死亡・移動の仮定を置いて2050年まで5年刻みで推計されています。本サイトは公表値をそのまま掲載し、独自の推計や補間は行っていません。",
  },
  {
    q: "この数字は将来を予測するものですか？",
    a: "一定の仮定に基づく公的推計であり、将来の人口を保証・断定するものではありません。今後の社会経済状況や政策によって実際の人口は変わり得ます。",
  },
  {
    q: "掲載されていない自治体があるのはなぜですか？",
    a: "福島県浜通りの13市町村は震災・原発事故の影響により「浜通り地域」として一括推計されており、市町村別の推計値が存在しません。北方領土の6村も推計対象外です。浜松市の中央区・浜名区は2024年の区再編前の旧区単位で推計されているため、現行の区別データがありません。",
  },
  {
    q: "現在の人口とどう違いますか？",
    a: "本サイトの現在人口は2025年国勢調査（速報）、将来推計の基準人口は2020年国勢調査です。調査基準が異なるため、増減率は推計内部の2020年値を分母に算出しています。",
  },
];

// 保育定員余裕率ランキングの注記・FAQ（可視テキストと構造化データの単一ソース）。
// しきい値（定員100人以上）を変える時は qualifies・note・FAQ を必ず同時に更新する。
const CHILDCARE_NOTE =
  "定員余裕率は（定員 − 利用児童数）÷ 定員で、こども家庭庁「保育所等関連状況取りまとめ」の公表実数（毎年4月1日時点）から算出しています。入りやすさの目安であり、年齢（特に0〜2歳）・地域・時期によって状況は大きく異なります。定員100人未満の自治体は率が振れやすいためランキングの対象外です。政令指定都市は市単位の集計です。";

const CHILDCARE_FAQ: { q: string; a: string }[] = [
  {
    q: "定員余裕率とは何ですか？",
    a: "保育所・認定こども園・地域型保育事業などの定員合計から利用児童数を引いた「空き」の割合です。こども家庭庁「保育所等関連状況取りまとめ」（毎年4月1日時点）の市区町村別の公表実数のみから算出しており、推計は行っていません。率が高いほど受け皿に余裕がある目安になりますが、年齢別・地域別の偏りは含まれます。",
  },
  {
    q: "待機児童ゼロなのに入りにくい地域があるのはなぜですか？",
    a: "待機児童の集計には、育児休業中の方・特定の保育園のみを希望している方・求職活動を休止している方が含まれません（いわゆる隠れ待機）。また0〜2歳児は定員が少なく、自治体全体では余裕があっても年齢や地域によっては入りにくいことがあります。各自治体ページでは待機児童数とあわせて、待機児童に含まれない申込者数も表示しています。",
  },
  {
    q: "掲載されていない自治体があるのはなぜですか？",
    a: "定員100人未満の自治体は保育所1園の開設・閉鎖で率が大きく動くため、ランキングの対象外としています（自治体ページでは定員・利用児童数を確認できます）。市区町村別データが公表されていない北方領土の村も対象外です。",
  },
];

// 1位自治体（実データ）から余裕率・基準時点を含む meta description を組み立てる。
function childcareMetaDescription(top1: Municipality | null): string {
  const head = "全国の市区町村を保育所等の定員余裕率（(定員−利用児童数)÷定員）が高い順にランキング。";
  const tail =
    "こども家庭庁「保育所等関連状況取りまとめ」の公表実数で、保育の入りやすさの目安を比較できます（定員100人以上の自治体が対象）。";
  if (!top1?.childcare) return `${head}${tail}`;
  const name = `${prefNameOf(top1.pref)}${top1.displayName ?? top1.name}`;
  return `${head}1位は${name}（余裕率${childcareOpenRatioText(top1.childcare)}、${formatAsOfJa(top1.childcare.asOf)}時点）。${tail}`;
}

// 1位自治体（実データ）から増減率・基準年を含む meta description を組み立てる。
function futureMetaDescription(direction: "decline" | "resilient") {
  const head =
    direction === "decline"
      ? "全国の市区町村を2050年の将来推計人口の減少率が大きい順にランキング。"
      : "全国の市区町村を2050年の将来推計人口の減少率が小さい順（増加を含む）にランキング。";
  const tail =
    "国立社会保障・人口問題研究所（令和5年推計）の公表値で、2050年に人口がどう変わる見込みかを比較できます。";
  return (top1: Municipality | null): string => {
    const rate = top1 ? futureChangeRate2050(top1.futurePopulation) : null;
    if (!top1 || rate == null) return `${head}${tail}`;
    const name = `${prefNameOf(top1.pref)}${top1.displayName ?? top1.name}`;
    return `${head}1位は${name}（2020年比${futureRateText(top1.futurePopulation)}）。${tail}`;
  };
}

// 人口・人口密度ランキングの meta description（1位の実数値を含む）。
// 2026-08 GSC分析: population-most 系は「{市} 人口」のような特定1市の人口を探す検索でも
// 上位表示されるが、一般的な description（{top1}名のみ）では「全国/県のランキング」に
// しか見えずクリックされにくい（例: 岡崎市 人口＝3位表示・impressions11・clicks0）。
// 都道府県別ページでは該当県の全市区町村を掲載していることを明記し、期待値を合わせる。
const POPULATION_METRIC_TEXT: Record<
  "most" | "densityHigh" | "densityLow",
  { noun: string; verb: string; valueOf: (m: Municipality) => string }
> = {
  most: { noun: "人口", verb: "多い", valueOf: (m) => `${m.population.toLocaleString()}人` },
  densityHigh: { noun: "人口密度", verb: "高い", valueOf: (m) => densityText(populationDensity(m) ?? 0) },
  densityLow: { noun: "人口密度", verb: "低い", valueOf: (m) => densityText(populationDensity(m) ?? 0) },
};

// 「日本一は{1位}」。population-most / population-density の seoTitleAnswer で共用する。
const nihonichiTop1 = (top1: Municipality): string => `日本一は${top1.displayName ?? top1.name}`;

function populationMetaDescription(metric: keyof typeof POPULATION_METRIC_TEXT) {
  const { noun, verb, valueOf } = POPULATION_METRIC_TEXT[metric];
  return (top1: Municipality | null): string => {
    const head = `全国の市区町村を${noun}が${verb}順にランキング。`;
    const tail = `都道府県ごとのページでは、県内の全市区町村を${noun}順に掲載しています。`;
    if (!top1) return `${head}国勢調査の実データで比較できます。${tail}`;
    const name = `${prefNameOf(top1.pref)}${top1.displayName ?? top1.name}`;
    return `${head}最も${noun}が${verb}のは${name}（${valueOf(top1)}、${POPULATION_FRESHNESS}）。${tail}`;
  };
}

// ---- 生活インフラ（駅・医療機関・保育施設）ランキング ----

// amenities.asOf は「駅 2025年度／保育 令和5年度／医療機関 2024年10月」の複合形式
// （scripts/_lib/versions.mjs の AMENITIES_ASOF）。指標ごとの鮮度ラベルには
// 該当部分だけを取り出して使う。キーが見つからない形式はそのまま返す。
export function amenityAsOfPart(asOf: string, key: "駅" | "保育" | "医療機関"): string {
  const m = new RegExp(`${key} ([^／]+)`).exec(asOf);
  return m ? m[1] : asOf;
}

// amenity 系の freshnessLabel（複合 asOf の部分抽出＋指標ごとのサフィックス）。
// freshnessFromAsOf は「◯◯最新」固定＋単一 asOf 前提のためここでは使えない。
function amenityFreshness(key: "駅" | "保育" | "医療機関", suffix: string) {
  return (top1: Municipality | null): string | null =>
    top1?.amenities ? `${amenityAsOfPart(top1.amenities.asOf, key)}${suffix}` : null;
}

// 生活インフラの集計対象か（北方領土など対象外センチネルの自治体を除外）。
const hasAmenities = (m: Municipality): boolean =>
  m.amenities != null && isAmenitiesCounted(m.amenities.source);

// 施設数ランキング共通の注意書き（実数＝規模に比例しやすいことの明示）。
const AMENITY_COUNT_CAVEAT =
  "面積や人口規模が大きい自治体ほど施設数は多くなりやすい実数であり、人口あたりの多さや利用のしやすさを直接示すものではありません。";

const STATIONS_FAQ: { q: string; a: string }[] = [
  {
    q: "駅数はどうやって数えていますか？",
    a: "国土数値情報「駅別乗降客数（S12）」の駅データを市区町村ごとに数えた実数です。複数路線が乗り入れる駅は駅コードで名寄せして1駅と数え、政令指定都市は区の駅の重複を除いて集計しています。",
  },
  {
    q: "駅が多いと住みやすいのですか？",
    a: "駅数は鉄道網の集積を示す客観的な指標のひとつで、住みやすさそのものを示すものではありません。駅までの距離・運行本数・行き先は駅数には含まれないため、あくまで目安としてご覧ください。",
  },
  {
    q: "データはいつ更新されますか？",
    a: "国土数値情報の駅データ（S12）は年度ごとに更新されます。新年度版の公表後、本サイトのデータも更新します。",
  },
];

const MEDICAL_FAQ: { q: string; a: string }[] = [
  {
    q: "医療機関数には何が含まれますか？",
    a: "厚生労働省「医療施設調査」の病院・一般診療所・歯科診療所の合計です。政府統計の公表実数のみで、推計値は使用していません。診療科別（小児科・産婦人科など）の内訳は含みません。",
  },
  {
    q: "医療機関が多いと医療に困らないのですか？",
    a: "医療機関数は医療資源の集積を示す客観的な指標のひとつですが、人口あたりの多さ・診療科の構成・救急対応などは含まれません。あくまで目安としてご覧ください。",
  },
  {
    q: "データはいつ更新されますか？",
    a: "医療施設調査は毎年10月1日時点で実施されます。市区町村別データの公表後、本サイトのデータも更新します。",
  },
];

const PRESCHOOLS_FAQ: { q: string; a: string }[] = [
  {
    q: "保育・幼稚園の施設数には何が含まれますか？",
    a: "保育所・幼稚園・認定こども園などの施設数の合計です（国土数値情報／不動産情報ライブラリの施設データ）。施設の実数であり、定員や空き状況は含みません。",
  },
  {
    q: "施設が多ければ保育園に入りやすいのですか？",
    a: "必ずしもそうではありません。施設数は人口規模に比例しやすいため、入りやすさの目安には定員に対する空きの割合（定員余裕率）をご覧ください。本サイトでは「保育の定員に余裕がある市区町村ランキング」として別に掲載しています。",
  },
  {
    q: "データはいつ更新されますか？",
    a: "施設データは年度ごとに更新されます。新年度データの公表・反映後、本サイトのデータも更新します。",
  },
];

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
    mapHub: "/map/rent",
    columnLabel: "家賃平均",
    order: "asc",
    nextUpdate: NEXT_UPDATE.rent,
    freshnessLabel: (top1) => (top1 ? housingSurveyLabel(top1.rent.asOf) : null),
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
    prefSummary: true,
    mapHub: "/map/rent",
    columnLabel: "家賃平均",
    order: "desc",
    nextUpdate: NEXT_UPDATE.rent,
    freshnessLabel: (top1) => (top1 ? housingSurveyLabel(top1.rent.asOf) : null),
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
    prefSummary: true,
    mapHub: "/map/vacancy",
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
    mapHub: "/map/vacancy",
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
    prefSummary: true,
    mapHub: "/map/land-price",
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
    mapHub: "/map/land-price",
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
    related: { slug: "childcare-capacity", label: "保育の定員に余裕がある市区町村" },
  },
  {
    slug: "childcare-capacity",
    category: "子育て・生活",
    title: "保育の定員に余裕がある市区町村ランキング",
    seoTitle: "保育園に入りやすい市区町村ランキング（保育所等の定員余裕率）",
    shortLabel: "保育に余裕",
    description:
      "全国の市区町村を保育所等の定員余裕率（(定員−利用児童数)÷定員）が高い順にランキング。最も余裕があるのは{top1}。こども家庭庁の公表実数で保育の入りやすさの目安を比較できます。",
    metaDescription: childcareMetaDescription,
    lead: "全国の市区町村を、保育所等の定員余裕率（(定員 − 利用児童数) ÷ 定員）が高い順に並べたランキングです。",
    note: CHILDCARE_NOTE,
    faq: CHILDCARE_FAQ,
    prefSummary: true,
    columnLabel: "定員余裕率",
    order: "desc",
    freshnessLabel: freshnessFromAsOf((m) => m.childcare?.asOf ?? ""),
    nextUpdate: NEXT_UPDATE.childcare,
    // 定員100人未満は分母が小さく率が振れやすい（保育所1園の増減で数十ptが動く）ため
    // ランキング対象外にする。しきい値は note・FAQ にも明記して整合させること。
    qualifies: (m) => hasChildcareCapacity(m.childcare) && m.childcare!.capacity >= 100,
    sortValue: (m) => childcareOpenRatioPct(m.childcare) ?? 0,
    display: (m) => childcareOpenRatioText(m.childcare),
    related: { slug: "waitlist-zero", label: "待機児童ゼロの市区町村" },
  },
  {
    slug: "stations",
    category: "子育て・生活",
    title: "駅が多い市区町村ランキング",
    shortLabel: "駅が多い",
    description:
      "全国の市区町村を鉄道駅の数が多い順にランキング。最も駅が多いのは{top1}。国土数値情報（S12 駅データ）の実データで、鉄道網の集積を比較できます。",
    lead: "全国の市区町村を、鉄道駅の数が多い順に並べたランキングです。",
    note: `駅数は国土数値情報「駅別乗降客数（S12）」の駅を市区町村ごとに数えた実数です（複数路線が乗り入れる駅は駅コードで名寄せして1駅と数えます）。${AMENITY_COUNT_CAVEAT}`,
    intro: [
      "このページは、全国の市区町村を鉄道駅の数が多い順に並べたランキングです。上位には、面積が広く複数の路線が乗り入れる大都市や、鉄道網の結節点となる自治体が並ぶ傾向があります。",
      "駅数は鉄道アクセスの集積を示す客観的な指標のひとつです。ただし駅までの距離・運行本数・行き先の情報は含まれないため、住みやすさの判断材料としては、家賃・人口・子育てなど他の指標とあわせてご覧ください。各順位の自治体名から、その地域の住環境データをまとめて確認できます。",
    ],
    faq: STATIONS_FAQ,
    related: { slug: "medical-facilities", label: "医療機関が多い市区町村" },
    columnLabel: "駅数",
    order: "desc",
    freshnessLabel: amenityFreshness("駅", "時点"),
    nextUpdate: NEXT_UPDATE.stations,
    qualifies: hasAmenities,
    sortValue: (m) => m.amenities?.stations ?? 0,
    display: (m) => `${(m.amenities?.stations ?? 0).toLocaleString()}駅`,
  },
  {
    slug: "medical-facilities",
    category: "子育て・生活",
    title: "医療機関が多い市区町村ランキング",
    seoTitle: "病院・診療所が多い市区町村ランキング（医療機関数）",
    shortLabel: "医療機関が多い",
    description:
      "全国の市区町村を医療機関数（病院・一般診療所・歯科診療所の合計）が多い順にランキング。最も多いのは{top1}。厚生労働省「医療施設調査」の実データで比較できます。",
    lead: "全国の市区町村を、医療機関数（病院・一般診療所・歯科診療所の合計）が多い順に並べたランキングです。",
    note: `医療機関数は厚生労働省「医療施設調査」の病院・一般診療所・歯科診療所の合計（公表実数）です。${AMENITY_COUNT_CAVEAT}診療科別の内訳や救急対応の有無は含みません。`,
    intro: [
      "このページは、全国の市区町村を医療機関の数が多い順に並べたランキングです。医療機関数は病院・一般診療所・歯科診療所の合計で、上位には人口規模の大きい大都市が並ぶ傾向があります。",
      "医療機関数は地域の医療資源の集積を示す客観的な指標のひとつです。人口あたりの多さや診療科の構成は含まれないため、あくまで目安として、家賃・子育て・災害リスクなど他の住環境データとあわせてご覧ください。",
    ],
    faq: MEDICAL_FAQ,
    related: { slug: "preschools", label: "保育園・幼稚園が多い市区町村" },
    columnLabel: "医療機関数",
    order: "desc",
    freshnessLabel: amenityFreshness("医療機関", "医療施設調査"),
    nextUpdate: NEXT_UPDATE.medical,
    qualifies: hasAmenities,
    sortValue: (m) => m.amenities?.medicalFacilities ?? 0,
    display: (m) => `${(m.amenities?.medicalFacilities ?? 0).toLocaleString()}件`,
  },
  {
    slug: "preschools",
    category: "子育て・生活",
    title: "保育園・幼稚園が多い市区町村ランキング",
    shortLabel: "保育・幼稚園が多い",
    description:
      "全国の市区町村を保育所・幼稚園・認定こども園の施設数が多い順にランキング。最も多いのは{top1}。施設の実数で子育てインフラの集積を比較できます。",
    lead: "全国の市区町村を、保育所・幼稚園・認定こども園などの施設数が多い順に並べたランキングです。",
    note: `施設数は保育所・幼稚園・認定こども園などの合計（国土数値情報／不動産情報ライブラリの施設データ）の実数です。${AMENITY_COUNT_CAVEAT}保育の入りやすさの目安には定員余裕率のランキングをご覧ください。`,
    intro: [
      "このページは、全国の市区町村を保育所・幼稚園・認定こども園などの施設数が多い順に並べたランキングです。施設数は人口規模に比例しやすいため、上位には子育て世帯の多い大都市が並ぶ傾向があります。",
      "「施設が多い」ことと「入りやすい」ことは別です。入りやすさの目安には、定員に対する空きの割合で比較する「保育の定員に余裕がある市区町村ランキング」をあわせてご覧ください。各順位の自治体名から、待機児童数・定員余裕率などの子育てデータをまとめて確認できます。",
    ],
    faq: PRESCHOOLS_FAQ,
    related: { slug: "childcare-capacity", label: "保育の定員に余裕がある市区町村" },
    columnLabel: "保育・幼稚園等",
    order: "desc",
    freshnessLabel: amenityFreshness("保育", "時点"),
    nextUpdate: NEXT_UPDATE.preschools,
    qualifies: hasAmenities,
    sortValue: (m) => m.amenities?.preschools ?? 0,
    display: (m) => `${(m.amenities?.preschools ?? 0).toLocaleString()}施設`,
  },
  {
    slug: "population-most",
    category: "人口・まち",
    title: "人口が多い市区町村ランキング",
    seoTitleAnswer: nihonichiTop1,
    prefSeoTitle: "市区町村 人口ランキング（人口が多い順）",
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
    seoTitleAnswer: nihonichiTop1,
    shortLabel: "人口密度が高い",
    description:
      "全国の市区町村を人口密度（人/km²）が高い順にランキング。最も人口密度が高いのは{top1}。国勢調査人口と国土地理院の面積データで比較できます。",
    metaDescription: populationMetaDescription("densityHigh"),
    lead: "全国の市区町村を、人口密度（人口 ÷ 面積、人/km²）が高い順に並べたランキングです。",
    note: "人口は2025年国勢調査（速報）、面積は国土地理院「全国都道府県市区町村別面積調」に基づきます。境界未定部を持つ自治体の面積は国土地理院公表の参考値です。",
    prefSummary: true,
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
      `全国の市区町村を5年間（${CENSUS_PERIOD}）の人口増減率が高い順にランキング。最も人口増加率が高いのは{top1}。国勢調査の実データで人口が増えている自治体を比較できます。`,
    lead: `全国の市区町村を、5年間（${CENSUS_PERIOD}）の人口増減率が高い順に並べたランキングです。`,
    note: "人口増減率は2020年と2025年の国勢調査人口の比較（%）で、転入・出生などの内訳は含みません。人口規模が小さい自治体や、震災からの帰還が進む自治体（福島県大熊町など）では率が大きく出ることがあります。",
    related: { slug: "future-population-resilient", label: "2050年も人口を維持する見込みの自治体" },
    mapHub: "/map/population-trend",
    prefSummary: true,
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
      `全国の市区町村を5年間（${CENSUS_PERIOD}）の人口減少率が高い順にランキング。最も人口が減っているのは{top1}。国勢調査の実データで人口が減っている自治体を比較できます。`,
    lead: `全国の市区町村を、5年間（${CENSUS_PERIOD}）の人口減少率が大きい順に並べたランキングです。`,
    note: "人口増減率は2020年と2025年の国勢調査人口の比較（%）で、転出・自然減などの内訳は含みません。人口規模が小さい自治体や、原発事故の避難区域を抱える自治体（福島県双葉町など）では減少率が大きく出ることがあります。人口が増えている自治体は表の下位（増加側）に並びます。",
    related: { slug: "future-population-decline", label: "2050年の将来推計人口ランキング" },
    mapHub: "/map/population-trend",
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
    slug: "future-population-decline",
    category: "人口・まち",
    title: "2050年推計人口の減少率が大きい市区町村ランキング",
    seoTitle: "2050年の将来推計人口 減少率ランキング",
    shortLabel: "2050年人口減少率",
    description:
      "全国の市区町村を2050年将来推計人口の減少率が大きい順にランキング。国立社会保障・人口問題研究所（令和5年推計）の公表値で比較できます。",
    metaDescription: futureMetaDescription("decline"),
    lead: "全国の市区町村を、2050年の将来推計人口の減少率（2020年国勢調査基準）が大きい順に並べたランキングです。",
    note: FUTURE_NOTE,
    faq: FUTURE_FAQ,
    mapHub: "/map/future-population",
    columnLabel: "人口増減率（2020→2050・推計）",
    order: "asc",
    freshnessLabel: () => FUTURE_FRESHNESS,
    nextUpdate: NEXT_UPDATE.future,
    qualifies: (m) => hasFuturePopulation(m.futurePopulation),
    sortValue: (m) => futureChangeRate2050(m.futurePopulation) ?? 0,
    display: (m) => futureRateText(m.futurePopulation),
  },
  {
    slug: "future-population-resilient",
    category: "人口・まち",
    title: "2050年推計人口の減少率が小さい市区町村ランキング",
    // 連続語「人口ランキング」を title 先頭側に作る（2026-08 GSC分析: 表示クエリは
    // 「2050年 人口 ランキング 市町村」系だが、旧 title は連続語を含まず 129imp/0click/11位）。
    seoTitle: "2050年の将来人口ランキング｜人口を維持する見込みの市区町村",
    shortLabel: "2050年人口維持",
    description:
      "全国の市区町村を2050年将来推計人口の減少率が小さい順（増加を含む）にランキング。国立社会保障・人口問題研究所（令和5年推計）の公表値で比較できます。",
    metaDescription: futureMetaDescription("resilient"),
    lead: "全国の市区町村を、2050年の将来推計人口の減少率（2020年国勢調査基準）が小さい順に並べたランキングです。推計上、人口が増える見込みの自治体が上位に入ります。",
    note: FUTURE_NOTE,
    faq: FUTURE_FAQ,
    mapHub: "/map/future-population",
    columnLabel: "人口増減率（2020→2050・推計）",
    order: "desc",
    freshnessLabel: () => FUTURE_FRESHNESS,
    nextUpdate: NEXT_UPDATE.future,
    qualifies: (m) => hasFuturePopulation(m.futurePopulation),
    sortValue: (m) => futureChangeRate2050(m.futurePopulation) ?? 0,
    display: (m) => futureRateText(m.futurePopulation),
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
    prefSummary: true,
    mapHub: "/map/foreign-ratio",
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
    mapHub: "/map/foreign-ratio",
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

/**
 * title を「強調する指標フレーズ」と「共通の語尾」に分ける（リンクラベルで指標
 * フレーズだけ太字にする用。RankLinkList 参照）。RANKINGS の title はすべて
 * 「◯◯市区町村ランキング」か「◯◯の市区町村」で終わる想定で、この不変条件は
 * tests/lib/rankings.test.ts が検証する（破ると rest が空になり全文太字に落ちる）。
 * タイトル定義と同じファイルに置き、title を増やす時に目に入るようにしている。
 */
export function splitRankingTitle(title: string): { em: string; rest: string } {
  for (const suffix of ["市区町村ランキング", "の市区町村"]) {
    if (title.endsWith(suffix)) return { em: title.slice(0, -suffix.length), rest: suffix };
  }
  return { em: title, rest: "" };
}

/** 市区町村のみ（政令市の行政区を除外）。ランキングは market-level の1自治体1エントリ。 */
export function muniLevelOnly(all: Municipality[]): Municipality[] {
  return all.filter((m) => (m.level ?? "muni") !== "ward");
}

/** 都道府県スラッグごとに自治体をまとめる（県内順位・県内中央値の集計で共通に使う）。 */
export function groupByPref(munis: Municipality[]): Map<string, Municipality[]> {
  const byPref = new Map<string, Municipality[]>();
  for (const m of munis) {
    const list = byPref.get(m.pref);
    if (list) list.push(m);
    else byPref.set(m.pref, [m]);
  }
  return byPref;
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
