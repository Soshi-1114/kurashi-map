import "../../../league.css";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  Trophy, BarChart3, Database, ArrowLeft, Map as MapIcon, ShieldCheck,
} from "lucide-react";
import { listMunicipalities } from "@/lib/metrics";
import { RANKINGS, getRankingBySlug, rankBy, medianOf, appendFreshness, type RankingDef } from "@/lib/rankings";
import { getRankPositions, getNationalMedians } from "@/lib/rankingStats";
import { PREFS, getPrefBySlug } from "@/lib/prefs";
import { SITE, absoluteUrl } from "@/lib/site";
import { mapHubByHref } from "@/lib/siteNav";
import { mapHrefForPref } from "@/lib/mapDeepLink";
import { getForeignStats } from "@/lib/foreignStats";
import { countWaitlistDisclosed } from "@/lib/waitlist";
import RankLinkList from "@/components/RankLinkList";
import RankFaq from "@/components/RankFaq";
import RankSources, { RANKING_SOURCES_TEXT } from "@/components/RankSources";
import { RankBadge } from "@/components/RankBadge";
import type { Municipality } from "@/lib/types";
import PageShell from "@/components/PageShell";
import { FurusatoBand } from "@/components/monetization/FurusatoBand";
import { ShareButton } from "@/components/ShareButton";

type Params = { metric: string; pref: string };

const TOP_CARDS = 10;

// 県 × 指標の総当たりのうち、対象データが1件以上ある組み合わせだけを生成する
// （0件のページは作らない＝薄いページを避ける）。
export async function generateStaticParams() {
  const params: Params[] = [];
  for (const p of PREFS) {
    const munis = await listMunicipalities(p.slug);
    for (const r of RANKINGS) {
      if (rankBy(r, munis, 1).length > 0) params.push({ metric: r.slug, pref: p.slug });
    }
  }
  return params;
}

// listMunicipalities は data/{slug}.json（市区町村）のみを返し、政令市の行政区
// （_wards.json）は含まない。東京特別区は muni 扱いで含まれるため、これは
// rankings の muniLevelOnly と同じ「1自治体1エントリ」になる。
async function rankedFor(def: RankingDef, prefSlug: string): Promise<Municipality[]> {
  return rankBy(def, await listMunicipalities(prefSlug));
}

// 県内サマリー（県固有の実数値）。県×指標のテンプレ同型ページに、その県でしか成立しない
// 数値（県内中央値・全国対比・県内1位の全国順位・値域）を持たせて独自性を担保する。
// 背景: GSC 分析（2026-07）で県別ランキングの一部が「クロール済み - インデックス未登録」
// に落ちており、テンプレ類似（薄ページ）判定の解消が狙い。値の整形は def.display を
// 「中央値に当たる自治体」に適用して使い回す（指標ごとの整形関数を二重定義しない）。
// 全国順位・全国中央値はキャッシュ済みの集計レイヤー（lib/rankingStats）から引く。
type PrefSummary = {
  prefMedian: Municipality;
  nationalMedian: Municipality;
  top1NationalRank: number;
  nationalCount: number;
  /** 県内中央値の全国対比（表示文言。sortValue 比較で導出） */
  vsNational: "同水準" | "高い水準" | "低い水準";
  /** 県内の値域（表示順: 小さい値 → 大きい値） */
  rangeLow: Municipality;
  rangeHigh: Municipality;
};

async function prefSummaryFor(def: RankingDef, ranked: Municipality[]): Promise<PrefSummary | null> {
  // membershipList 型（待機児童ゼロ等の「該当自治体の一覧」）は値の分布ではないため対象外。
  if (ranked.length === 0 || def.membershipList) return null;
  const top1 = (await getRankPositions()).get(def.slug)?.get(ranked[0].code);
  const nationalMedian = (await getNationalMedians()).get(def.slug);
  if (!top1 || !nationalMedian) return null;
  const prefMedian = medianOf(ranked);
  const d = def.sortValue(prefMedian) - def.sortValue(nationalMedian);
  const [rangeLow, rangeHigh] =
    def.order === "asc" ? [ranked[0], ranked[ranked.length - 1]] : [ranked[ranked.length - 1], ranked[0]];
  return {
    prefMedian,
    nationalMedian,
    top1NationalRank: top1.rank,
    nationalCount: top1.total,
    vsNational: d === 0 ? "同水準" : d > 0 ? "高い水準" : "低い水準",
    rangeLow,
    rangeHigh,
  };
}

export async function generateMetadata(props: { params: Promise<Params> }): Promise<Metadata> {
  const params = await props.params;
  const def = getRankingBySlug(params.metric);
  const pref = getPrefBySlug(params.pref);
  if (!def || !pref) return { title: "見つかりません | KurashiMap" };
  const ranked = await rankedFor(def, params.pref);
  const top1 = ranked[0] ? (ranked[0].displayName ?? ranked[0].name) : "—";
  const freshness = def.freshnessLabel?.(ranked[0] ?? null) ?? null;
  const fresh = freshness ? `【${freshness}】` : "";
  const title = `${pref.nameJa}の${def.prefSeoTitle ?? def.seoTitle ?? def.title}${fresh}｜市区町村を比較｜${SITE.name}`;
  // description にも県固有の実数値（県内中央値）を含め、検索結果スニペットで即答する。
  // 「{pref}内○○市区町村を掲載」は先頭付近に置く: 2026-08 GSC分析で、県別ページには
  // 「{市} 人口」のような特定1市を探す検索が着地するが、この情報が末尾だと検索結果の
  // スニペット切れで見えず「県全体のランキングだけ」と誤解されクリックされない例が
  // 確認できた（例: /ranking/population-most/aichi の「岡崎市 人口」3位表示・クリック0）。
  const medianText = ranked.length > 0 && !def.membershipList ? `県内中央値は${def.display(medianOf(ranked))}。` : "";
  // 末尾にデータの基準年度を追記（文中に同じ年が既出ならスキップ）。
  const description = appendFreshness(
    `${pref.nameJa}の${def.title}（${pref.nameJa}内${ranked.length}市区町村を掲載）。1位は${top1}。${medianText}政府統計の実データで比較できる${SITE.name}。`,
    freshness,
  );
  const url = absoluteUrl(`/ranking/${def.slug}/${pref.slug}`);
  const ogImage = absoluteUrl(`/api/og/ranking/${def.slug}`);
  return {
    title,
    description,
    metadataBase: new URL(SITE.baseUrl),
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: SITE.locale,
      url,
      title,
      description,
      siteName: SITE.name,
      images: [{ url: ogImage, width: 1200, height: 630, alt: `${pref.nameJa}の${def.title}` }],
    },
    twitter: { card: "summary_large_image", title, description, images: [ogImage] },
  };
}

export default async function PrefRankingPage(props: { params: Promise<Params> }) {
  const params = await props.params;
  const def = getRankingBySlug(params.metric);
  const pref = getPrefBySlug(params.pref);
  if (!def || !pref) notFound();

  const munis = await listMunicipalities(params.pref);
  const ranked = rankBy(def, munis);
  if (ranked.length === 0) notFound();
  const prefName = pref.nameJa;
  const isList = Boolean(def.membershipList);

  // データ鮮度ラベル・導入文・FAQ（定義のある指標のみ）。
  const freshness = def.freshnessLabel?.(ranked[0] ?? null) ?? null;
  const intro = def.prefIntro?.(prefName) ?? [];
  const faq = def.faq ?? [];

  // 全国版と同じポディウム（1〜3位）＋ラダー（4位〜）の分割。11位以下は
  // トップ10と同じセクション内の details（エクスパンド）に畳む。
  const podium = ranked.slice(0, 3);
  const ladder = ranked.slice(3, TOP_CARDS);
  const rest = ranked.slice(TOP_CARDS);

  // ラダー（4位〜10位）とエクスパンド内（11位〜）で同一の行マークアップを共有する。
  // 全国版のラダーは県名の副行が付くため共通化せず、このページ内だけの重複を畳む。
  const ladderOl = (items: Municipality[], start: number) => (
    <ol className="rk-ladder" start={start}>
      {items.map((m, i) => (
        <li key={m.code}>
          <Link href={`/area/${m.pref}/${m.code}`} className="rk-ladder-row">
            <RankBadge className="rk-ladder-rank" isList={isList} rank={start + i} />
            <span className="rk-ladder-name">{m.displayName ?? m.name}</span>
            <span className="rk-ladder-value">{def.display(m)}</span>
          </Link>
        </li>
      ))}
    </ol>
  );

  // 県内サマリー（県内中央値・全国対比・県内1位の全国順位）。membershipList 型は
  // 値の分布を持たないため、「公表対象のうち該当n自治体」の要約に切り替える。
  const summary = await prefSummaryFor(def, ranked);
  const waitlistDisclosed = isList ? countWaitlistDisclosed(munis) : null;

  // 外国人住民比率ランキングのベンチマーク（県平均・全国平均）。すべて実データ由来。
  // fc は県平均・全国平均が定数なので、ランキング先頭自治体の集計値から1件取得すれば足りる。
  let benchmark: { prefAvg: number; nationalAvg: number } | null = null;
  if (def.compareForeignAvg) {
    const fc = (await getForeignStats()).get(ranked[0].code);
    if (fc) benchmark = { prefAvg: fc.prefAvg, nationalAvg: fc.nationalAvg };
  }

  // 同じ県の「ほかの指標」リンク（データのある指標のみ）
  const otherMetrics = RANKINGS.filter(
    (r) => r.slug !== def.slug && rankBy(r, munis, 1).length > 0,
  );
  // 対応する地図ハブがある指標のみ「地図で見る」CTA を出す。?pref= ディープリンクで
  // 当該県へ初期フォーカスする（lib/mapDeepLink.ts）。
  const mapHub = mapHubByHref(def.mapHub);
  // 関連ランキング導線は、リンク先の県別ページにデータがある場合のみ（0件ページは存在しない）。
  const relatedDef = def.related;
  const related = relatedDef && otherMetrics.some((r) => r.slug === relatedDef.slug) ? relatedDef : null;

  const ldJson = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: SITE.name, item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: "ランキング", item: absoluteUrl("/ranking") },
          { "@type": "ListItem", position: 3, name: def.title, item: absoluteUrl(`/ranking/${def.slug}`) },
          { "@type": "ListItem", position: 4, name: prefName, item: absoluteUrl(`/ranking/${def.slug}/${pref.slug}`) },
        ],
      },
      {
        "@type": "ItemList",
        name: `${prefName}の${def.title}`,
        numberOfItems: ranked.length,
        itemListElement: ranked.map((m, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: m.displayName ?? m.name,
          url: absoluteUrl(`/area/${m.pref}/${m.code}`),
        })),
      },
      ...(faq.length > 0
        ? [
            {
              "@type": "FAQPage",
              mainEntity: faq.map(({ q, a }) => ({
                "@type": "Question",
                name: q,
                acceptedAnswer: { "@type": "Answer", text: a },
              })),
            },
          ]
        : []),
    ],
  };

  return (
    <PageShell innerClassName="rk-root" trail={[{ name: SITE.name, href: "/" }, { name: "ランキング", href: "/ranking" }, { name: def.shortLabel, href: `/ranking/${def.slug}` }, { name: prefName }]}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldJson) }} />


      <header className="rk-hero rk-reveal">
        <span className="rk-eyebrow"><Database size={14} aria-hidden="true" />都道府県別ランキング</span>
        <h1 className="rk-title">{prefName}の{def.title}</h1>
        <p className="rk-lead">
          {def.lead.replace("全国の", `${prefName}の`)}データのある{ranked.length}市区町村を、政府統計の実データで集計しています（推計値は含みません）。
        </p>
        <ul className="rk-hero-meta">
          <li className="rk-meta-pill">
            <Trophy size={13} aria-hidden="true" />
            {isList ? (
              <>県内 <b>{ranked.length}</b> 自治体が該当</>
            ) : (
              <><b>{ranked.length}</b> 市区町村を掲載</>
            )}
          </li>
          {freshness && <li className="rk-meta-pill"><ShieldCheck size={13} aria-hidden="true" />{freshness}</li>}
          <li className="rk-meta-pill"><Database size={13} aria-hidden="true" />政府統計の実データ</li>
        </ul>
        {def.note && <p className="rk-lead rk-lead--note">{def.note}</p>}
        {def.nextUpdate && <p className="rk-lead rk-lead--note">📅 次回更新予定: {def.nextUpdate}</p>}
        <div className="rk-hero-actions">
          <Link href={`/ranking/${def.slug}`} className="rk-action rk-action-primary">
            <BarChart3 size={15} aria-hidden="true" />全国版を見る
          </Link>
          <Link href={`/area/${pref.slug}`} className="rk-action rk-action-ghost">
            <MapIcon size={15} aria-hidden="true" />{prefName}の全自治体
          </Link>
          {mapHub && (
            <Link href={mapHrefForPref(pref.slug, mapHub.href)} className="rk-action rk-action-ghost">
              <MapIcon size={15} aria-hidden="true" />{mapHub.label}
            </Link>
          )}
          {related && (
            <Link href={`/ranking/${related.slug}/${pref.slug}`} className="rk-action rk-action-ghost">
              <BarChart3 size={15} aria-hidden="true" />{prefName}の{related.label}
            </Link>
          )}
          <ShareButton
            className="rk-action rk-action-ghost"
            title={`${prefName}の${def.title}｜${SITE.name}`}
            path={`/ranking/${def.slug}/${pref.slug}`}
            contentType="ranking"
            itemId={`${def.slug}/${pref.slug}`}
            label="共有する"
          />
        </div>
      </header>

      {(summary || waitlistDisclosed !== null) && (
        <section className="rk-section">
          <div className="rk-section-head">
            <span className="rk-section-icon"><BarChart3 size={20} aria-hidden="true" /></span>
            <div className="rk-section-heading">
              <h2 className="rk-h2">{prefName}のデータ概況</h2>
            </div>
          </div>
          {summary ? (
            <>
              <div className="rk-intro">
                <p>
                  {prefName}内で集計対象となる{ranked.length}市区町村のうち、県内中央値は
                  {def.display(summary.prefMedian)}（{summary.prefMedian.displayName ?? summary.prefMedian.name}）で、
                  全国中央値{def.display(summary.nationalMedian)}と比べて{summary.vsNational}です。
                  県内1位の{ranked[0].displayName ?? ranked[0].name}（{def.display(ranked[0])}）は、
                  全国{summary.nationalCount.toLocaleString()}自治体中{summary.top1NationalRank.toLocaleString()}位に相当します。
                  県内の値の幅は{def.display(summary.rangeLow)}〜{def.display(summary.rangeHigh)}です。
                </p>
              </div>
              <ul className="mini-cards cols-2">
                <li className="mini-card">
                  <div className="mini-card-label">県内中央値</div>
                  <div className="mini-card-value">{def.display(summary.prefMedian)}</div>
                  <p className="mini-card-sub">全国中央値: {def.display(summary.nationalMedian)}</p>
                </li>
                <li className="mini-card">
                  <div className="mini-card-label">県内1位の全国順位</div>
                  <div className="mini-card-value">
                    {summary.top1NationalRank.toLocaleString()}<span className="unit"> 位</span>
                  </div>
                  <p className="mini-card-sub">全国{summary.nationalCount.toLocaleString()}自治体中（{ranked[0].displayName ?? ranked[0].name}）</p>
                </li>
              </ul>
            </>
          ) : (
            <div className="rk-intro">
              <p>
                {prefName}では、待機児童数が公表されている{waitlistDisclosed}自治体のうち
                {ranked.length}自治体が待機児童ゼロです（人口が多い順に掲載）。
              </p>
            </div>
          )}
        </section>
      )}

      {intro.length > 0 && (
        <section className="rk-section">
          <div className="rk-intro">
            {intro.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </section>
      )}

      {benchmark && (
        <section className="rk-section">
          <div className="rk-section-head">
            <span className="rk-section-icon"><BarChart3 size={20} aria-hidden="true" /></span>
            <div className="rk-section-heading">
              <h2 className="rk-h2">ベンチマーク（平均との比較）</h2>
            </div>
          </div>
          <ul className="mini-cards cols-2">
            <li className="mini-card">
              <div className="mini-card-label">{prefName}平均</div>
              <div className="mini-card-value">{benchmark.prefAvg.toFixed(2)}<span className="unit"> %</span></div>
              <p className="mini-card-sub">{prefName}内 全市区町村の加重平均</p>
            </li>
            <li className="mini-card">
              <div className="mini-card-label">全国平均</div>
              <div className="mini-card-value">{benchmark.nationalAvg.toFixed(2)}<span className="unit"> %</span></div>
              <p className="mini-card-sub">全国 全市区町村の加重平均</p>
            </li>
          </ul>
        </section>
      )}

      {/* トップ10と全順位を1セクションに統合し、11位以下は details（エクスパンド）で
          全件表示する。JS 不要の native details（rk-sources・rk-faq と同じ流儀）。 */}
      <section className="rk-section">
        <div className="rk-section-head">
          <span className="rk-section-icon"><Trophy size={20} aria-hidden="true" /></span>
          <div className="rk-section-heading">
            <h2 className="rk-h2">
              {isList
                ? `該当する自治体（${def.columnLabel}が多い順・全${ranked.length}自治体）`
                : `${prefName}のランキング（全${ranked.length}自治体）`}
            </h2>
            <p className="rk-section-sub">
              {isList
                ? `順位ではなく、条件に該当する自治体の一覧です（掲載順は${def.columnLabel}の多い順）。`
                : `${def.columnLabel}でみる県内の全順位。自治体名から住環境データの詳細へ。`}
            </p>
          </div>
        </div>

        {podium.length > 0 && (
          <ol className="rk-podium" aria-label={isList ? "該当する自治体" : "トップ3"}>
            {podium.map((m, i) => (
              <li key={m.code} style={{ display: "contents" }}>
                <Link href={`/area/${m.pref}/${m.code}`} className={`rk-podium-card is-${i + 1}`}>
                  <RankBadge className="rk-medal" isList={isList} rank={i + 1} rankAriaLabel={`${i + 1}位`} />
                  <span className="rk-podium-body">
                    <span className="rk-podium-name">{m.displayName ?? m.name}</span>
                    <span className="rk-podium-value">{def.display(m)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}

        {ladder.length > 0 && ladderOl(ladder, 4)}

        {rest.length > 0 && (
          <details className="rk-more">
            <summary className="rk-more-summary">
              <span className="rk-more-open">
                {isList
                  ? `${TOP_CARDS + 1}件目以降を表示（全${ranked.length}自治体）`
                  : `${TOP_CARDS + 1}位以下を表示（全${ranked.length}自治体）`}
              </span>
              <span className="rk-more-close">閉じる</span>
            </summary>
            {ladderOl(rest, TOP_CARDS + 1)}
          </details>
        )}
      </section>

      <RankLinkList
        title={`${prefName}のほかのランキング`}
        sub={`同じ実データで、${prefName}を別の指標でも比べてみましょう。`}
        rankings={otherMetrics}
        href={(r) => `/ranking/${r.slug}/${pref.slug}`}
        labelPrefix={`${prefName}の`}
      />

      {/* ふるさと納税の導線（検索流入の主戦場）。FAQ・出典より上=ランキング直後に置く */}
      <FurusatoBand />

      <RankFaq faq={faq} />

      <RankSources>{RANKING_SOURCES_TEXT}</RankSources>


      <nav className="rk-footnav" aria-label="関連リンク">
        <Link href={`/ranking/${def.slug}`} className="rk-back"><ArrowLeft size={15} aria-hidden="true" />全国版</Link>
        <Link href="/ranking" className="rk-back"><Trophy size={15} aria-hidden="true" />ランキング一覧</Link>
        <Link href={`/area/${pref.slug}`} className="rk-back"><MapIcon size={15} aria-hidden="true" />{prefName}の一覧</Link>
      </nav>
    </PageShell>
  );
}
