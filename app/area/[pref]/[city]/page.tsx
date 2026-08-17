import "./area-detail.css";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  MapPin,
  Home,
  Users,
  JapaneseYen,
  Baby,
  Wallet,
  ShieldAlert,
  Building2,
  Globe2,
  TrainFront,
  Stethoscope,
  Info,
  Trophy,
  Map as MapIcon,
  ArrowLeft,
  ArrowUpRight,
  Search,
  BarChart3,
  Sparkles,
} from "lucide-react";
import { getMunicipality, listAll, listAllAcrossPrefs } from "@/lib/metrics";
import { buildSummary } from "@/lib/summary";
import { findRelatedByRent, findSimilar, findClosePopulationInPref } from "@/lib/related";
import {
  RANKINGS, formatAsOfJa, POPULATION_FRESHNESS, POPULATION_ASOF,
  housingSurveyLabel, landPriceSurveyLabel, freshnessPrefix,
} from "@/lib/rankings";
import { mapHrefForCode } from "@/lib/mapDeepLink";
import { muniLastModified } from "@/lib/dataFreshness";
import { getRankPositions } from "@/lib/rankingStats";
import { buildFaq } from "@/lib/faq";
import { SITE, prefNameOf, absoluteUrl } from "@/lib/site";
import { getAmbiguousNames } from "@/lib/muniLabel";
import { buildMuniTitle } from "@/lib/muniMeta";
import { hasRent, rentBand } from "@/lib/rentColor";
import { isWaitlistDisclosed } from "@/lib/waitlist";
import { hasLandPrice } from "@/lib/landPrice";
import { hasVacancy, vacancyRateText } from "@/lib/vacancy";
import { isAmenitiesCounted, coverageReason } from "@/lib/coverage";
import { hasForeignData, foreignRatioPct, hasForeignRatio } from "@/lib/foreignResidents";
import {
  hasFuturePopulation,
  futureTotal,
  futureChangeRate2050,
  futureRateText,
  ageComposition2050,
  futurePopSource,
} from "@/lib/futurePopulation";
import { getForeignStats, avgBand, type ForeignComparison } from "@/lib/foreignStats";
import { getAreaStats } from "@/lib/areaStats";
import { getPrefRanks } from "@/lib/prefRanks";
import { buildHighlights } from "@/lib/highlights";
import { buildInsights } from "@/lib/insights";
import { computeLivability } from "@/lib/livabilityScore";
import { Reveal } from "@/components/area/Reveal";
import { Section } from "@/components/area/Section";
import { ScorePanel } from "@/components/area/ScorePanel";
import { OverviewCard } from "@/components/area/OverviewCard";
import { DisasterCard } from "@/components/area/DisasterCard";
import { CompareBar, type CompareRow } from "@/components/area/CompareBar";
import { HighlightList } from "@/components/area/HighlightList";
import {
  KpiCard,
  MetricCard,
  MetricPrimary,
  AreaLinkCard,
  RankingCard,
  SimilarAreaCard,
  NoData,
  SourceLine,
} from "@/components/area/cards";
import { SupportBanner } from "@/components/area/SupportBanner";
import { FurusatoLink } from "@/components/area/FurusatoLink";
import { DenkiTeaser } from "@/components/area/DenkiTeaser";
import { supportUrl, furusatoUrlTemplate } from "@/lib/monetization";
import PageShell from "@/components/PageShell";
import SectionNav, { type SectionNavItem } from "@/components/area/SectionNav";

type Params = { pref: string; city: string };

export async function generateStaticParams() {
  const all = await listAllAcrossPrefs();
  return all.map((m) => ({ pref: m.pref, city: m.code }));
}

export async function generateMetadata(props: { params: Promise<Params> }): Promise<Metadata> {
  const params = await props.params;
  const m = await getMunicipality(params.city);
  if (!m) return { title: "見つかりません | KurashiMap" };
  const prefName = prefNameOf(m.pref);
  const fullName = m.displayName ?? m.name;
  const pop = m.population.toLocaleString();

  // 在留外国人割合。対象外（北方領土6村）・人口0 は foreignRatioPct がセンチネルを返す。
  // 「{自治体} 外国人 割合」は大手が手薄な検索意図で本サイトの主力（441表示・平均8.9位）
  // だが、title を独占させると他の意図を締め出すため、配置は lib/muniMeta.ts を参照。
  const foreignRatio = foreignRatioPct(m);
  const hasForeign = hasForeignRatio(foreignRatio);
  // 全国平均・順位の比較統計。政令市の行政区は 1自治体1エントリの集計から外れるため
  // 取得できず、description は比率のみの文面になる（比率自体は上で算出済み）。
  const fc = hasForeign ? (await getForeignStats()).get(m.code) ?? null : null;

  const title = buildMuniTitle(m, {
    prefName,
    ambiguous: (await getAmbiguousNames()).has(fullName),
  });

  // description には実数値を2〜3個含める。title に出した人口・家賃を実数（丸めなし）で
  // 先頭に置き、title で削った「住みやすさ」もここで補う。在留外国人割合には全国平均・
  // 全国順位という title に入らない文脈を担わせる（数値はビルド時データ由来）。
  const descRent = hasRent(m.rent.value) ? `家賃平均${m.rent.value.toLocaleString()}円/月、` : "";
  // description 冒頭の「更新」バッジ用。本文に実際に書く指標の asOf だけを集める
  // （地価など本文に出てこない指標を混ぜるとバッジの年と本文が食い違うため）。
  const bodyAsOf: (string | null)[] = [
    m.population > 0 ? POPULATION_ASOF : null,
    hasRent(m.rent.value) ? m.rent.asOf : null,
  ];
  let description: string;
  if (hasForeign) {
    // 比較統計が取れる場合はそれを載せ、代わりに出典表記を落とす（文字数の都合。
    // 出典はページ本文と構造化データが持つ）。
    const context = fc
      ? `（全国平均${fc.nationalAvg.toFixed(2)}%、全国${fc.nationalRank.toLocaleString()}位・${formatAsOfJa(m.foreignResidents.asOf)}時点）`
      : "";
    const source = fc ? "" : `出典: 出入国在留管理庁「在留外国人統計」（${formatAsOfJa(m.foreignResidents.asOf)}）。`;
    const prefix = freshnessPrefix([...bodyAsOf, m.foreignResidents.asOf]);
    description = `${prefix}${fullName}（${prefName}）の人口は${pop}人（${POPULATION_FRESHNESS}）、${descRent}在留外国人割合${foreignRatio.toFixed(2)}%${context}。地価・子育て・災害リスクなどの住環境データと住みやすさスコアを地図とランキングで比較できます。${source}`;
  } else {
    // このフォールバックは北方領土6村相当（在留外国人統計・人口ともに対象外）のみが
    // 到達する。上の分岐（GSC分析に基づき調整済み）と違い実質的な閲覧数が小さいため、
    // 「特徴」の先頭1件があれば1文だけ添えて差異化する（0件ならそのまま）。
    const popPhrase = m.population > 0 ? `人口${pop}人（${POPULATION_FRESHNESS}）、` : "";
    const [areaStats, rankPositions, prefRanks] = await Promise.all([
      getAreaStats(),
      getRankPositions(),
      getPrefRanks(),
    ]);
    const highlights = buildHighlights(m, { areaStats, foreign: null, rankPositions, prefRanks, prefName });
    const topHighlightKey = highlights[0]?.key;
    const highlightPhrase = highlights.length > 0 ? `${highlights[0].text}。` : "";
    // 末尾の指標列挙は、直前のハイライト文とテーマが重複するものだけを外す
    // （例: 待機児童ゼロが特徴文で既に出ていれば「待機児童」を列挙し直さない）。
    const topics = ["地価", "待機児童", "災害リスク"]
      .filter((t) => !(t === "地価" && topHighlightKey === "landPrice") && !(t === "待機児童" && topHighlightKey === "waitlistZero"))
      .join("・");
    // highlightPhrase が待機児童ゼロの文（asOf 入り）を本文に書く場合は、そのasOfも
    // バッジ候補に含める（本文に出てくる年をバッジが漏らさないようにする）。
    const prefix = freshnessPrefix([
      ...bodyAsOf,
      topHighlightKey === "waitlistZero" ? m.waitlistChildren.asOf : null,
    ]);
    description = `${prefix}${fullName}（${prefName}）の住みやすさ・住環境データ。${popPhrase}${descRent}${highlightPhrase}${topics}などをまとめて地図とランキングで比較できる${SITE.name}の自治体ページ。`;
  }
  const url = absoluteUrl(`/area/${m.pref}/${m.code}`);
  const ogImage = absoluteUrl(`/api/og/${m.code}`);
  return {
    title,
    description,
    metadataBase: new URL(SITE.baseUrl),
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      locale: SITE.locale,
      url,
      title,
      description,
      siteName: SITE.name,
      images: [{ url: ogImage, width: 1200, height: 630, alt: `${m.name}の住みやすさサマリー` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function AreaPage(props: { params: Promise<Params> }) {
  const params = await props.params;
  const m = await getMunicipality(params.city);
  if (!m) notFound();

  const all = await listAll(m.pref);
  // 同じ階層（市区町村なら市区町村、区なら区）の中から類似自治体を選ぶ
  const peers = all.filter((x) => (x.level ?? "muni") === (m.level ?? "muni"));
  const related = findRelatedByRent(peers, m, 6);
  const relatedCodes = new Set(related.map((r) => r.code));
  // 「似ているエリア」は家賃＋人口規模で算出し、家賃が近い一覧と重複しないよう除外する。
  const similar = findSimilar(peers, m, 3, relatedCodes);
  const prefName = prefNameOf(m.pref);
  const parent = m.parentCode ? all.find((x) => x.code === m.parentCode) ?? null : null;
  const heading = m.displayName ?? m.name;
  const support = supportUrl();
  // 将来人口カードの派生値。const に取れば型ガードの絞り込みが JSX 内へ伝播する。
  const fp = m.futurePopulation;
  const fp2050 = futureTotal(fp, "2050");
  const fpRate = futureChangeRate2050(fp);
  const fpAges = ageComposition2050(fp);

  // 人口規模が近い同県内の自治体（回遊導線）。「家賃が近い」「似ているエリア」との重複を除外。
  const closePop = findClosePopulationInPref(peers, m, 4, new Set([...relatedCodes, ...similar.map((s) => s.code)]));
  // 同県の主要自治体（人口の多い順）。自身と既出カード（家賃が近い・似ている・人口規模が近い）を除く。
  const excluded = new Set([m.code, ...relatedCodes, ...similar.map((s) => s.code), ...closePop.map((p) => p.code)]);
  const majorPeers = peers
    .filter((x) => !excluded.has(x.code))
    .sort((a, b) => b.population - a.population)
    .slice(0, 6);
  // 行政区ページなら同じ政令市の他の区（兄弟区）へのリンクを張る。
  const siblings =
    m.level === "ward" && m.parentCode
      ? all.filter((x) => x.level === "ward" && x.parentCode === m.parentCode && x.code !== m.code)
      : [];
  // 政令市の親ページなら区一覧への「下り」リンクを張る。従来は兄弟区（区→区）と
  // パンくず（区→親）しかなく、親→区へ辿れる内部リンクがサイト内に存在しなかった
  // （GSC 分析 2026-07: 名古屋市の区ページ群が「検出 - インデックス未登録」でクロール未到達）。
  const childWards =
    (m.level ?? "muni") === "muni"
      ? all.filter((x) => x.level === "ward" && x.parentCode === m.code)
      : [];

  // 解釈の補助線・比較バーの平均値（すべて実データから集計。推計なし）。互いに独立
  // な集計なので並列に取得する（各モジュールとも初回のみ全自治体を走査しキャッシュする）。
  const [foreignStats, areaStats, rankPositions, prefRanks] = await Promise.all([
    getForeignStats(),
    getAreaStats(),
    getRankPositions(),
    getPrefRanks(),
  ]);
  const fc: ForeignComparison | null = foreignStats.get(m.code) ?? null;

  // 「この自治体の特徴」= 全国・県平均との偏差や順位から決定論的に抽出（lib/highlights.ts）。
  const highlights = buildHighlights(m, { areaStats, foreign: fc, rankPositions, prefRanks, prefName });

  // 住みやすさ総合スコア・5軸（実データのみ。治安は法務方針で対象外）。
  const liv = computeLivability(m);

  // 「データで見る」= 他自治体との相対比較文（県平均との乖離・全国順位・全国平均対比）。
  // 自治体ごとに内容が変わるページ固有テキストで、量産テンプレ感を下げる（SEO）。
  const insights = buildInsights(m, { prefName, areaStats, rankPositions, fc });

  const breadcrumbItems: Array<{ name: string; item: string }> = [
    { name: SITE.name, item: absoluteUrl("/") },
    { name: prefName, item: absoluteUrl(`/area/${m.pref}`) },
  ];
  if (parent) {
    breadcrumbItems.push({ name: parent.name, item: absoluteUrl(`/area/${parent.pref}/${parent.code}`) });
  }
  breadcrumbItems.push({ name: m.name, item: absoluteUrl(`/area/${m.pref}/${m.code}`) });

  // よくある質問（可視テキストと FAQPage 構造化データで同じソースを共有）
  const faq = buildFaq(m, prefName);

  // セクションナビ（ページ内アンカー）。コンテンツは隠さず、飛び先を示すだけ。
  // 回遊セクション（家賃が近い／似ているエリア／人口規模が近い／行政区／兄弟区／
  // 主要自治体）はどれもデータ次第で消えるため、最初に描画されるものへ #compare を
  // 付ける。1つも無ければ「比較」の項目自体を出さない（存在しない飛び先を作らない）。
  const firstCompareKey = ([
    ["related", related.length > 0],
    ["similar", similar.length > 0],
    ["closePop", closePop.length > 0],
    ["childWards", childWards.length > 0],
    ["siblings", siblings.length > 0 && parent != null],
    ["majorPeers", majorPeers.length > 0],
  ] as const).find(([, present]) => present)?.[0];
  const compareAnchor = (key: string) => (key === firstCompareKey ? "compare" : undefined);

  const navItems: SectionNavItem[] = [
    { id: "overview", label: "概要" },
    { id: "data", label: "データ" },
    ...(firstCompareKey ? [{ id: "compare", label: "比較" }] : []),
    { id: "ranking", label: "ランキング" },
    { id: "details", label: "詳細情報" },
  ];

  // Dataset 構造化データ（政府統計の実データを地理単位で提示する性質に適合）。
  // variableMeasured は実データのある指標のみ載せる（欠損は推計しない honesty 方針）。
  const variableMeasured = [
    hasRent(m.rent.value) && { "@type": "PropertyValue", name: "民営借家の家賃平均", unitText: "JPY/月", value: m.rent.value },
    hasLandPrice(m.landPrice.value) && { "@type": "PropertyValue", name: "住宅地地価（公示地価）", unitText: "JPY/m2", value: m.landPrice.value },
    { "@type": "PropertyValue", name: "人口", unitText: "人", value: m.population },
    isWaitlistDisclosed(m.waitlistChildren) && { "@type": "PropertyValue", name: "待機児童数", unitText: "人", value: m.waitlistChildren.value },
    hasForeignData(m.foreignResidents.source) && { "@type": "PropertyValue", name: "外国人住民比率", unitText: "%", value: Number(foreignRatioPct(m).toFixed(2)) },
  ].filter(Boolean);

  const lastModified = muniLastModified(m);
  const dataset = {
    "@type": "Dataset",
    name: `${prefName}${heading}の生活統計データ（家賃・地価・人口・災害リスク・外国人比率）`,
    description: `${prefName}${heading}の家賃平均・公示地価・人口・待機児童数・災害リスク（浸水／土砂／津波／高潮／液状化）・在留外国人比率を、政府統計（総務省・国土交通省・こども家庭庁・出入国在留管理庁）および国土数値情報の実データでまとめた統計データセット。推計値は使用していません。`,
    url: absoluteUrl(`/area/${m.pref}/${m.code}`),
    identifier: m.code,
    keywords: ["家賃平均", "公示地価", "人口", "待機児童", "災害リスク", "外国人住民比率", heading, prefName],
    isAccessibleForFree: true,
    creator: { "@type": "Organization", name: SITE.name, url: SITE.baseUrl },
    includedInDataCatalog: { "@type": "DataCatalog", name: "e-Stat 政府統計の総合窓口", url: "https://www.e-stat.go.jp/" },
    spatialCoverage: {
      "@type": "Place",
      name: `${prefName}${heading}`,
      containedInPlace: { "@type": "AdministrativeArea", name: prefName },
    },
    // 収録指標のうち最も新しい asOf を更新日として明示（鮮度シグナル）。
    ...(lastModified ? { dateModified: lastModified.toISOString().slice(0, 10) } : {}),
    variableMeasured,
  };

  const ldJson = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: breadcrumbItems.map((b, i) => ({
          "@type": "ListItem", position: i + 1, name: b.name, item: b.item,
        })),
      },
      {
        "@type": "AdministrativeArea",
        name: heading,
        addressCountry: "JP",
        containedInPlace: parent
          ? { "@type": "AdministrativeArea", name: parent.name, containedInPlace: { "@type": "AdministrativeArea", name: prefName } }
          : { "@type": "AdministrativeArea", name: prefName },
        identifier: m.code,
        url: absoluteUrl(`/area/${m.pref}/${m.code}`),
      },
      dataset,
      {
        "@type": "FAQPage",
        mainEntity: faq.map(({ q, a }) => ({
          "@type": "Question",
          name: q,
          acceptedAnswer: { "@type": "Answer", text: a },
        })),
      },
    ],
  };

  // 家賃の比較バー（自治体／県平均／全国平均）。有効値のみ行に積む。
  const rentRows: CompareRow[] = [];
  if (hasRent(m.rent.value)) {
    rentRows.push({ label: m.name, value: m.rent.value, self: true });
    const pa = areaStats.rent.byPref.get(m.pref);
    if (pa != null) rentRows.push({ label: `${prefName}平均`, value: pa });
    if (areaStats.rent.national != null) rentRows.push({ label: "全国平均", value: areaStats.rent.national });
  }

  // 外国人住民比率の比較バー（fc がある＝対象かつ比較可能なときのみ）。
  const foreignRows: CompareRow[] = fc
    ? [
        { label: m.name, value: fc.ratio, self: true },
        { label: `${prefName}平均`, value: fc.prefAvg },
        { label: "全国平均", value: fc.nationalAvg },
      ]
    : [];

  const yen = (v: number) => `${v.toLocaleString()}円`;
  const pct = (v: number) => `${v.toFixed(2)}%`;

  // KPI カードの比較文脈（全国順位・県内順位・全国平均）。取れない部分は省略する。
  // 家賃は全国平均との高低で「安い順」「高い順」のどちらのランキングを見せるか切り替える
  // （lib/highlights.ts の rankSuffix と同じ方向判定。高い自治体に「安い順で1,900位」は出さない）。
  const rentAboveAvg = areaStats.rent.national != null && m.rent.value > areaStats.rent.national;
  const rentRankPos = rankPositions.get(rentAboveAvg ? "rent-high" : "rent-cheap")?.get(m.code);
  const rentCompare = hasRent(m.rent.value)
    ? [
        rentRankPos ? `${rentAboveAvg ? "高い" : "安い"}順で全国${rentRankPos.rank.toLocaleString()}位` : null,
        areaStats.rent.national != null ? `全国平均${areaStats.rent.national.toLocaleString()}円` : null,
      ].filter(Boolean).join("・") || undefined
    : undefined;
  const popNatPos = rankPositions.get("population-most")?.get(m.code);
  const popPrefPos = prefRanks.get("population-most")?.get(m.code);
  const popCompare =
    [
      popPrefPos ? `${prefName}内${popPrefPos.rank.toLocaleString()}位/${popPrefPos.total.toLocaleString()}` : null,
      popNatPos ? `全国${popNatPos.rank.toLocaleString()}位` : null,
    ].filter(Boolean).join("・") || undefined;
  const landCompare =
    hasLandPrice(m.landPrice.value) && areaStats.landPrice.national != null
      ? `全国平均${areaStats.landPrice.national.toLocaleString()}円/㎡`
      : undefined;

  // 主要指標の基準時点まとめ（honesty 注記に併記）。欠損している指標は列挙しない。
  // 各カードの詳細な出典・年度は SourceLine が担うため、ここは主要4指標に絞る。
  const asOfSummary = [
    m.population > 0 ? `人口 ${POPULATION_FRESHNESS}` : null,
    hasRent(m.rent.value) ? `家賃 ${housingSurveyLabel(m.rent.asOf)}` : null,
    hasLandPrice(m.landPrice.value) ? `地価 ${landPriceSurveyLabel(m.landPrice.source, m.landPrice.asOf)}` : null,
    hasForeignData(m.foreignResidents.source) ? `在留外国人 ${formatAsOfJa(m.foreignResidents.asOf)}時点` : null,
  ].filter(Boolean).join("／");

  return (
    <PageShell
      width="wide"
      innerClassName="ad-root"
      trail={[
        { name: SITE.name, href: "/" },
        { name: prefName, href: `/area/${m.pref}` },
        ...(parent ? [{ name: parent.name, href: `/area/${parent.pref}/${parent.code}` }] : []),
        { name: m.name },
      ]}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldJson) }} />
      {/* ① Hero */}
      <header className="ad-hero" id="overview">
        <div className="ad-hero-main">
          <Link href={`/area/${m.pref}`} className="ad-pref-badge">
            <MapPin size={14} aria-hidden="true" />
            {prefName}
          </Link>
          <h1 className="ad-title">
            {heading}
            <span className="ad-title-sub">の住みやすさ</span>
          </h1>
          <p className="ad-lead">{buildSummary(m)}</p>
          <Link href={`/compare?codes=${m.code}`} className="ad-compare-add ad-compare-add-hero">
            この自治体を比較ページで見る<ArrowUpRight size={13} aria-hidden="true" />
          </Link>
        </div>

        <ScorePanel liv={liv} />
      </header>
      {/* ページ内ナビ（sticky）。長い詳細ページのどこに何があるかを示す。
          タブではないのでコンテンツは隠さない。 */}
      <SectionNav items={navItems} municipalityCode={m.code} />
      {/* この自治体の特徴（全国・県平均との偏差や順位から決定論的に抽出。評価語なし） */}
      {highlights.length > 0 && (
        <Section
          icon={Sparkles}
          tone="ad-tone-pop"
          title={`${m.name}の特徴`}
          sub={`全国・${prefName}平均との比較で目立つ指標`}
        >
          <HighlightList highlights={highlights} />
        </Section>
      )}
      {/* AI総評 + こんな人におすすめ */}
      <Reveal>
        <OverviewCard m={m} liv={liv} />
      </Reveal>
      {/* データで見る（他自治体との相対比較。ページ固有の可視テキストを増やす） */}
      {insights.length > 0 && (
        <Reveal>
          <Section
            icon={BarChart3}
            tone="ad-tone-pop"
            title={`データで見る${m.name}`}
            sub={`${prefName}平均・全国と比べた${m.name}の位置づけ`}
          >
            <ul className="ad-insights">
              {insights.map((s, i) => (
                <li key={i} className="ad-insight">{s}</li>
              ))}
            </ul>
          </Section>
        </Reveal>
      )}
      {/* ② KPIカード */}
      <Reveal>
        <div className="ad-kpis">
          <KpiCard
            icon={Home}
            tone="ad-tone-rent"
            label="家賃平均"
            value={hasRent(m.rent.value) ? m.rent.value.toLocaleString() : null}
            unit="円/月"
            sub={hasRent(m.rent.value) ? `県内で${rentBand(m.rent.value)}` : undefined}
            compare={rentCompare}
          />
          <KpiCard
            icon={Users}
            tone="ad-tone-pop"
            label="人口"
            value={m.population.toLocaleString()}
            unit="人"
            sub={`人口トレンド: ${m.populationTrend}`}
            compare={popCompare}
          />
          <KpiCard
            icon={JapaneseYen}
            tone="ad-tone-rent"
            label="地価（住宅地）"
            value={hasLandPrice(m.landPrice.value) ? m.landPrice.value.toLocaleString() : null}
            unit="円/㎡"
            compare={landCompare}
            nodataLabel="対象外"
          />
          <KpiCard
            icon={Baby}
            tone="ad-tone-kids"
            label="待機児童"
            value={isWaitlistDisclosed(m.waitlistChildren) ? `${m.waitlistChildren.value}` : null}
            unit="人"
            sub={
              isWaitlistDisclosed(m.waitlistChildren) && m.waitlistChildren.value === 0
                ? "待機児童ゼロ"
                : undefined
            }
            nodataLabel="非公表"
          />
        </div>
      </Reveal>
      <p className="ad-honesty">
        <Info size={16} aria-hidden="true" />
        数値は政府統計・国土数値情報の実データです。データのない項目は推計で埋めず「データなし／対象外」と明示しています。
        {asOfSummary ? `主なデータの基準時点: ${asOfSummary}。` : ""}
      </p>
      {/* ③ 詳細情報グリッド */}
      <Section icon={Wallet} tone="ad-tone-rent" title="詳細データ" id="data">
        <div className="ad-metric-grid">
          {/* 家賃・住宅コスト */}
          <MetricCard
            icon={Wallet}
            tone="ad-tone-rent"
            title="家賃・住居コスト"
            badge={hasRent(m.rent.value) ? { text: rentBand(m.rent.value), tone: "is-warn" } : undefined}
            link={{ href: "/ranking/rent-high", label: "家賃ランキングで比較" }}
          >
            <MetricPrimary value={hasRent(m.rent.value) ? m.rent.value.toLocaleString() : null} unit="円/月" />
            {rentRows.length > 0 ? (
              <CompareBar rows={rentRows} format={yen} caption="家賃平均の比較（自治体・県平均・全国平均）" />
            ) : (
              <p className="ad-note"><Info size={15} aria-hidden="true" />住宅統計の集計対象外のため家賃データはありません。</p>
            )}
            <p className="ad-note">
              地価（住宅地）:{" "}
              {hasLandPrice(m.landPrice.value)
                ? `${m.landPrice.value.toLocaleString()}円/㎡`
                : `データなし（${coverageReason(m.landPrice.source)}）`}
            </p>
            <p className="ad-note">
              空き家率:{" "}
              {hasVacancy(m.vacancy)
                ? `${vacancyRateText(m.vacancy)}（空き家${m.vacancy.vacant.toLocaleString()}戸 / 住宅${m.vacancy.total.toLocaleString()}戸・2023年）`
                : "データなし（住宅統計の集計対象外）"}
            </p>
            {hasRent(m.rent.value) && (
              <p className="ad-note">
                <Info size={15} aria-hidden="true" />
                <span>
                  家賃は住宅・土地統計調査の家賃階級別の借家数から、階級の中点で加重平均した算出値です（
                  <Link href="/about#calc" className="ad-note-link">算出方法</Link>）。
                </span>
              </p>
            )}
            {hasRent(m.rent.value) && <SourceLine source={m.rent.source} asOf={m.rent.asOf} estimated={m.rent.isEstimated} />}
          </MetricCard>

          {/* 子育て */}
          <MetricCard
            icon={Baby}
            tone="ad-tone-kids"
            title="子育て環境"
            badge={
              isWaitlistDisclosed(m.waitlistChildren) && m.waitlistChildren.value === 0
                ? { text: "待機児童ゼロ", tone: "is-good" }
                : undefined
            }
            link={{ href: "/ranking/waitlist-zero", label: "待機児童ゼロの自治体" }}
          >
            {isWaitlistDisclosed(m.waitlistChildren) ? (
              <>
                <MetricPrimary value={`${m.waitlistChildren.value}`} unit="人" />
                <p className="ad-note">待機児童数（{formatAsOfJa(m.waitlistChildren.asOf)}）</p>
                <SourceLine source={m.waitlistChildren.source} asOf={m.waitlistChildren.asOf} />
              </>
            ) : (
              <NoData text="区別非公表です。" reason={m.waitlistChildren.source.replace("区別非公表（", "").replace(/）.*$/, "")} />
            )}
          </MetricCard>

          {/* 災害リスク（横長） */}
          <div className="ad-span-2">
            <MetricCard icon={ShieldAlert} tone="ad-tone-hazard" title="災害リスク">
              <DisasterCard m={m} />
            </MetricCard>
          </div>

          {/* 生活インフラ */}
          {m.amenities && (
            <MetricCard icon={Building2} tone="ad-tone-infra" title="生活インフラ">
              {isAmenitiesCounted(m.amenities.source) ? (
                <>
                  <div className="ad-statline">
                    <span className="ad-stat">
                      <span className="ad-stat-value">{m.amenities.stations.toLocaleString()}</span>
                      <span className="ad-stat-label"><TrainFront size={12} aria-hidden="true" /> 駅数</span>
                    </span>
                    <span className="ad-stat">
                      <span className="ad-stat-value">{m.amenities.preschools.toLocaleString()}</span>
                      <span className="ad-stat-label"><Baby size={12} aria-hidden="true" /> 保育・幼稚園</span>
                    </span>
                    <span className="ad-stat">
                      <span className="ad-stat-value">{m.amenities.medicalFacilities.toLocaleString()}</span>
                      <span className="ad-stat-label"><Stethoscope size={12} aria-hidden="true" /> 医療機関</span>
                    </span>
                  </div>
                  <SourceLine source={m.amenities.source} asOf={m.amenities.asOf} />
                </>
              ) : (
                <NoData text="集計対象外です。" reason={coverageReason(m.amenities.source)} />
              )}
            </MetricCard>
          )}

          {/* 外国人比率 */}
          <MetricCard
            icon={Globe2}
            tone="ad-tone-foreign"
            title="外国人住民（多様性・国際性）"
            link={{ href: mapHrefForCode(m.code, "/map/foreign-ratio"), label: "地図・ランキングで見る" }}
          >
            {hasForeignData(m.foreignResidents.source) ? (
              <>
                <MetricPrimary value={foreignRatioPct(m).toFixed(2)} unit="%" />
                <p className="ad-note">外国人住民 {m.foreignResidents.value.toLocaleString()}人</p>
                {foreignRows.length > 0 && fc ? (
                  <>
                    <CompareBar rows={foreignRows} format={pct} caption="外国人住民比率の比較（自治体・県平均・全国平均）" />
                    <p className="ad-note">
                      全国平均（{fc.nationalAvg.toFixed(2)}%）
                      {avgBand(fc.ratio, fc.nationalAvg) === "similar"
                        ? "と同程度"
                        : `より${avgBand(fc.ratio, fc.nationalAvg) === "higher" ? "高め" : "低め"}`}
                      。比率の高い順で全国 {fc.nationalRank.toLocaleString()}位 / {fc.nationalTotal.toLocaleString()}自治体。多様性・国際性の目安です。
                    </p>
                  </>
                ) : (
                  <p className="ad-note"><Info size={15} aria-hidden="true" />全国・県平均との比較は、比較データがないため表示していません。</p>
                )}
                <SourceLine source={m.foreignResidents.source} asOf={m.foreignResidents.asOf} />
              </>
            ) : (
              <NoData text="在留外国人統計の対象外です。" reason={coverageReason(m.foreignResidents.source)} />
            )}
          </MetricCard>

          {/* 将来人口（IPSS 公的推計）。「今と将来」を同じ画面で見る2050暮らしビューの土台。
              titleへの反映は行わない（進行中のtitle刷新の計測と競合させない。
              docs/seo/gsc-seo-roadmap-2026-08.md 参照）。 */}
          <div className="ad-span-2">
            <MetricCard
              icon={Users}
              tone="ad-tone-pop"
              title="将来人口（公的推計）"
              link={{ href: mapHrefForCode(m.code, "/map/future-population"), label: "2050年推計人口を地図で見る" }}
            >
              {hasFuturePopulation(fp) ? (
                <>
                  <MetricPrimary value={(fp2050 ?? 0).toLocaleString()} unit="人（2050年・推計）" />
                  {fpRate != null && (
                    <p className="ad-note">2020年（推計の基準年）比 {futureRateText(fp)}</p>
                  )}
                  <CompareBar
                    rows={[
                      { label: `現在（${POPULATION_FRESHNESS}）`, value: m.population, self: true },
                      { label: "2030年（推計）", value: futureTotal(fp, "2030") ?? 0 },
                      { label: "2040年（推計）", value: futureTotal(fp, "2040") ?? 0 },
                      { label: "2050年（推計）", value: fp2050 ?? 0 },
                    ]}
                    format={(v) => `${v.toLocaleString()}人`}
                    caption="現在人口と将来推計人口の推移"
                  />
                  {fpAges && (
                    <p className="ad-note">
                      2050年の年齢構成（推計）: 年少（0-14歳）{fp.young2050.toLocaleString()}人（{fpAges.young.toFixed(1)}%）・
                      生産年齢（15-64歳）{fp.working2050.toLocaleString()}人（{fpAges.working.toFixed(1)}%）・
                      高齢（65歳以上）{fp.elderly2050.toLocaleString()}人（{fpAges.elderly.toFixed(1)}%）
                    </p>
                  )}
                  <p className="ad-note">
                    <Info size={15} aria-hidden="true" />
                    <span>
                      国立社会保障・人口問題研究所（令和5(2023)年推計）の公表値です。一定の仮定に基づく公的推計であり、将来を保証するものではありません。推計の基準は2020年国勢調査で、現在人口（2025年国勢調査）とは調査基準が異なります。
                    </span>
                  </p>
                  <SourceLine source={fp.source} asOf={fp.asOf} estimated />
                </>
              ) : (
                <NoData
                  text="市区町村別の将来推計はありません。"
                  reason={coverageReason(futurePopSource(fp))}
                />
              )}
            </MetricCard>
          </div>
        </div>
      </Section>
      {/* 家賃が近い自治体 */}
      {related.length > 0 && (
        <Section icon={Home} tone="ad-tone-rent" title="家賃水準が近い自治体" sub={`${m.name}と家賃平均が近い${prefName}の自治体`} id={compareAnchor("related")}>
          <ul className="ad-arealink-grid">
            {related.map((r) => (
              <li key={r.code}>
                <AreaLinkCard
                  href={`/area/${r.pref}/${r.code}`}
                  name={r.displayName ?? r.name}
                  meta={hasRent(r.rent.value) ? `${r.rent.value.toLocaleString()}円/月` : "データなし"}
                />
                <Link href={`/compare?codes=${m.code},${r.code}`} className="ad-compare-add">＋比較する</Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {/* 似ているエリア */}
      {similar.length > 0 && (
        <Section icon={Search} tone="ad-tone-pop" title="似ているエリアを探す" sub={`${m.name}と特徴が似ているエリア`} id={compareAnchor("similar")}>
          <ul className="ad-similar-grid">
            {similar.map((s) => (
              <li key={s.code}>
                <SimilarAreaCard
                  href={`/area/${s.pref}/${s.code}`}
                  name={s.displayName ?? s.name}
                  comment="家賃・人口規模が近い"
                  rent={hasRent(s.rent.value) ? `${s.rent.value.toLocaleString()}円` : null}
                  population={`${s.population.toLocaleString()}人`}
                />
                <Link href={`/compare?codes=${m.code},${s.code}`} className="ad-compare-add">＋比較する</Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {/* 人口規模が近い同県内の自治体 */}
      {closePop.length > 0 && (
        <Section
          icon={Users}
          tone="ad-tone-pop"
          title={`人口規模が近い${prefName}の自治体`}
          sub={`${m.name}（人口${m.population.toLocaleString()}人）と規模が近い自治体`}
          id={compareAnchor("closePop")}
        >
          <ul className="ad-arealink-grid">
            {closePop.map((p) => (
              <li key={p.code}>
                <AreaLinkCard
                  href={`/area/${p.pref}/${p.code}`}
                  name={p.displayName ?? p.name}
                  meta={`人口 ${p.population.toLocaleString()}人`}
                />
                <Link href={`/compare?codes=${m.code},${p.code}`} className="ad-compare-add">＋比較する</Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {/* 政令市の親ページ → 区一覧（下りリンク） */}
      {childWards.length > 0 && (
        <Section icon={MapIcon} tone="ad-tone-infra" title={`${m.name}の行政区（${childWards.length}区）`} sub="区ごとの家賃・人口・住環境データを見る" id={compareAnchor("childWards")}>
          <ul className="ad-arealink-grid">
            {childWards.map((w) => (
              <li key={w.code}>
                <AreaLinkCard
                  href={`/area/${w.pref}/${w.code}`}
                  name={w.name}
                  meta={hasRent(w.rent.value) ? `${w.rent.value.toLocaleString()}円/月` : "データなし"}
                />
              </li>
            ))}
          </ul>
        </Section>
      )}
      {/* 兄弟区 */}
      {siblings.length > 0 && parent && (
        <Section icon={MapIcon} tone="ad-tone-infra" title={`${parent.name}のほかの区`} id={compareAnchor("siblings")}>
          <ul className="ad-arealink-grid">
            {siblings.map((s) => (
              <li key={s.code}>
                <AreaLinkCard
                  href={`/area/${s.pref}/${s.code}`}
                  name={s.name}
                  meta={hasRent(s.rent.value) ? `${s.rent.value.toLocaleString()}円/月` : "データなし"}
                />
              </li>
            ))}
          </ul>
        </Section>
      )}
      {/* 主要自治体 */}
      {majorPeers.length > 0 && (
        <Section
          icon={Users}
          tone="ad-tone-pop"
          title={`${prefName}の主要自治体`}
          sub={`${prefName}で人口の多い自治体`}
          link={{ href: `/area/${m.pref}`, label: `全${prefName}の一覧` }}
          id={compareAnchor("majorPeers")}
        >
          <ul className="ad-arealink-grid">
            {majorPeers.map((p) => (
              <li key={p.code}>
                <AreaLinkCard
                  href={`/area/${p.pref}/${p.code}`}
                  name={p.displayName ?? p.name}
                  meta={`人口 ${p.population.toLocaleString()}人`}
                />
              </li>
            ))}
          </ul>
        </Section>
      )}
      {/* ランキング */}
      <Section icon={Trophy} tone="ad-tone-hazard" title="ランキングで比較" id="ranking">
        <ul className="ad-rank-grid">
          {RANKINGS.map((r) => {
            const pos = rankPositions.get(r.slug)?.get(m.code);
            // membershipList 型（例: 待機児童ゼロ）は「条件に該当する自治体の一覧」で、
            // 並び順は人口など別の指標。順位として見せると意味を誤読するため出さない。
            const rankText = pos
              ? r.membershipList
                ? `該当（全国 ${pos.total.toLocaleString()}自治体）`
                : `全国 ${pos.rank.toLocaleString()}位 / ${pos.total.toLocaleString()}`
              : undefined;
            return (
              <li key={r.slug}>
                <RankingCard
                  icon={Trophy}
                  title={r.shortLabel}
                  rankText={rankText}
                  href={`/ranking/${r.slug}`}
                />
              </li>
            );
          })}
        </ul>
      </Section>
      {/* FAQ（Accordion・デフォルト閉じる） */}
      <Section icon={Info} tone="ad-tone-infra" title={`${m.name}のよくある質問`} id="details">
        <div className="ad-faq">
          {faq.map(({ q, a }, i) => (
            <details key={i} className="ad-faq-item">
              <summary className="ad-faq-q">{q}</summary>
              <div className="ad-faq-a">{a}</div>
            </details>
          ))}
        </div>
      </Section>
      {/* 出典（折りたたみ） */}
      <Reveal>
        <details className="ad-sources">
          <summary className="ad-sources-summary">
            <Info size={15} aria-hidden="true" />
            出典・データについて
          </summary>
          <p className="ad-sources-body">
            本ページの数値は政府統計・国土数値情報の実データです。家賃は住宅・土地統計調査、人口は国勢調査（ともに e-Stat 経由）、地価は地価公示・地価調査、ハザード・生活インフラは不動産情報ライブラリ（reinfolib）／国土数値情報、待機児童はこども家庭庁、外国人住民は出入国在留管理庁「在留外国人統計」（e-Stat）の公表値に基づきます。総合スコアは公表値のみから算出した目安で、データのない指標は除外しています。データのない項目は推計で埋めず「データなし／対象外」と明示しています。
          </p>
        </details>
      </Reveal>
      {/* 生活関連の導線（データ可視化エリアとは視覚的に分離）。
          電気代シミュレーターは内部リンクで常時表示。
          ふるさと納税は提携ASP確定（env設定）まで非表示 */}
      <Reveal>
        <section className="ad-support-section" aria-label="生活関連の参考リンク">
          {/* 供給エリア名（自治体固有情報）を添えて /denki にプリセット遷移 */}
          <DenkiTeaser municipalityCode={m.code} municipalityName={m.name} />
          {support && (
            <SupportBanner url={support} municipalityCode={m.code} municipalityName={m.name} />
          )}
          {/* 政令市の行政区は寄付先が親の政令市になるため、寄付先名は親市名を使う */}
          {furusatoUrlTemplate() && (
            <FurusatoLink
              targetName={m.level === "ward" && parent ? parent.name : m.name}
              prefName={prefName}
              municipalityCode={m.code}
            />
          )}
        </section>
      </Reveal>
      {/* ページ下部 CTA */}
      <Reveal>
        <section className="ad-cta">
          <h2 className="ad-cta-title">条件を変えてエリアを探す</h2>
          <p className="ad-cta-sub">あなたの希望条件に合うエリアを見つけましょう。</p>
          <ul className="ad-cta-chips">
            <li>
              <Link href="/ranking/rent-cheap" className="ad-cta-chip"><Wallet size={16} aria-hidden="true" />家賃が安いエリア</Link>
            </li>
            <li>
              <Link href="/ranking/waitlist-zero" className="ad-cta-chip"><Baby size={16} aria-hidden="true" />待機児童ゼロ</Link>
            </li>
            <li>
              <Link href="/map/foreign-ratio" className="ad-cta-chip"><Globe2 size={16} aria-hidden="true" />外国人比率で見る</Link>
            </li>
            <li>
              <Link href={mapHrefForCode(m.code)} className="ad-cta-chip"><MapIcon size={16} aria-hidden="true" />地図で見る</Link>
            </li>
          </ul>
        </section>
      </Reveal>
      <div className="ad-footnav">
        <Link href={`/area/${m.pref}`} className="ad-back"><ArrowLeft size={14} aria-hidden="true" />{prefName}の一覧</Link>
        <Link href="/ranking" className="ad-back"><Trophy size={14} aria-hidden="true" />ランキング</Link>
        <Link href={mapHrefForCode(m.code)} className="ad-back"><MapIcon size={14} aria-hidden="true" />地図で見る</Link>
      </div>
    </PageShell>
  );
}
