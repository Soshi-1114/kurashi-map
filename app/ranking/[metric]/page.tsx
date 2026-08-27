import "../../league.css";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  Trophy, BarChart3, MapPin, Database, ArrowLeft, Map as MapIcon, ShieldCheck,
} from "lucide-react";
import { listAllAcrossPrefs } from "@/lib/metrics";
import { RANKINGS, getRankingBySlug, muniLevelOnly, rankBy, appendFreshness, type RankingDef } from "@/lib/rankings";
import { PREFS } from "@/lib/prefs";
import { SITE, prefNameOf, absoluteUrl } from "@/lib/site";
import { mapHubByHref } from "@/lib/siteNav";
import PrefRegionLinks from "@/components/PrefRegionLinks";
import RankLinkList from "@/components/RankLinkList";
import RankFaq from "@/components/RankFaq";
import RankSources, { RANKING_SOURCES_TEXT } from "@/components/RankSources";
import { RankBadge } from "@/components/RankBadge";
import PageShell from "@/components/PageShell";

type Params = { metric: string };

// 上位何件まで掲載するか（ポディウム=3、カード=10、テーブル=100）。
const TOP_CARDS = 10;
const TOP_TABLE = 100;

export function generateStaticParams() {
  return RANKINGS.map((r) => ({ metric: r.slug }));
}

async function rankedFor(def: RankingDef, limit: number) {
  const munis = muniLevelOnly(await listAllAcrossPrefs());
  return rankBy(def, munis, limit);
}

export async function generateMetadata(props: { params: Promise<Params> }): Promise<Metadata> {
  const params = await props.params;
  const def = getRankingBySlug(params.metric);
  if (!def) return { title: "見つかりません | KurashiMap" };
  const top = await rankedFor(def, 1);
  const top1 = top[0] ? `${prefNameOf(top[0].pref)}${top[0].displayName ?? top[0].name}` : "—";
  const freshness = def.freshnessLabel?.(top[0] ?? null) ?? null;
  // 「｜日本一は{1位}」のような答えフレーズは 1位が実在するときだけ title 末尾に足す。
  const answer = top[0] && def.seoTitleAnswer ? `｜${def.seoTitleAnswer(top[0])}` : "";
  const title = `${def.seoTitle ?? def.title}${answer}${freshness ? `【${freshness}】` : "【全国】"}｜${SITE.name}`;
  // description 末尾にデータの基準年度を追記（文中に同じ年が既出ならスキップ）。
  const description = appendFreshness(
    def.metaDescription ? def.metaDescription(top[0] ?? null) : def.description.replace("{top1}", top1),
    freshness,
  );
  const url = absoluteUrl(`/ranking/${def.slug}`);
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
      images: [{ url: ogImage, width: 1200, height: 630, alt: def.title }],
    },
    twitter: { card: "summary_large_image", title, description, images: [ogImage] },
  };
}

export default async function RankingPage(props: { params: Promise<Params> }) {
  const params = await props.params;
  const def = getRankingBySlug(params.metric);
  if (!def) notFound();

  const allMunis = muniLevelOnly(await listAllAcrossPrefs());
  // limit なしで一度だけ絞り込み・整列し、掲載用の先頭 TOP_TABLE 件と該当総数の
  // 両方をここから導く（allMunis を二度フィルタしない）。
  const fullRanked = rankBy(def, allMunis);
  const ranked = fullRanked.slice(0, TOP_TABLE);
  if (ranked.length === 0) notFound();
  const podium = ranked.slice(0, 3);          // トップ3＝順位台
  const ladder = ranked.slice(3, TOP_CARDS);  // 4位以降＝序列ラダー
  // membershipList 型（例: 待機児童ゼロ）は「条件に該当する自治体の一覧」で、並び順は
  // 人口など別の指標。順位・メダル・「N位」表記を出すと意味を誤読するため見せ方を変える。
  const isList = def.membershipList === true;
  // 一覧型は掲載数（TOP_TABLE で頭打ち）と該当総数が大きく違う。「該当N自治体」が
  // 掲載数に見えないよう、該当総数を別に数えて併記する。
  const qualifiedCount = isList ? fullRanked.length : ranked.length;

  const others = RANKINGS.filter((r) => r.slug !== def.slug);
  // 対応する地図ハブがある指標のみ「地図で見る」CTA を出す（GA4 分析 2026-08:
  // ランキング流入が地図体験まで届いていないため、ヒーローに共通導線を置く）。
  const mapHub = mapHubByHref(def.mapHub);
  // この指標に該当データがある都道府県（県別ランキングへの導線）
  const prefsWithData = PREFS.filter((p) => allMunis.some((m) => m.pref === p.slug && def.qualifies(m)));

  // データ鮮度ラベル（指標の asOf 由来）。
  const top1 = ranked[0] ?? null;
  const top1Name = top1 ? `${prefNameOf(top1.pref)}${top1.displayName ?? top1.name}` : "—";
  const freshness = def.freshnessLabel?.(top1) ?? null;
  // 薄ページ対策の導入文・FAQ（定義があるランキングのみ）。{top1} は1位自治体名に置換。
  const intro = def.intro?.map((p) => p.replace(/\{top1\}/g, top1Name)) ?? [];
  const faq = def.faq?.map(({ q, a }) => ({ q, a: a.replace(/\{top1\}/g, top1Name) })) ?? [];

  const ldJson = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: SITE.name, item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: "ランキング", item: absoluteUrl("/ranking") },
          { "@type": "ListItem", position: 3, name: def.title, item: absoluteUrl(`/ranking/${def.slug}`) },
        ],
      },
      {
        "@type": "ItemList",
        name: `${def.title}${freshness ? `【${freshness}】` : "【全国】"}`,
        numberOfItems: ranked.length,
        itemListElement: ranked.map((m, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: `${prefNameOf(m.pref)}${m.displayName ?? m.name}`,
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
    <PageShell innerClassName="rk-root" trail={[{ name: SITE.name, href: "/" }, { name: "ランキング", href: "/ranking" }, { name: def.shortLabel }]}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldJson) }} />


      <header className="rk-hero rk-reveal">
        <span className="rk-eyebrow"><Database size={14} aria-hidden="true" />全国ランキング</span>
        <h1 className="rk-title">{def.title}</h1>
        <p className="rk-lead">
          {def.lead}データのある自治体のみを対象に、政府統計の実データで集計しています（推計値は含みません）。
        </p>
        <ul className="rk-hero-meta">
          <li className="rk-meta-pill">
            <Trophy size={13} aria-hidden="true" />
            {isList ? (
              <>全国 <b>{qualifiedCount.toLocaleString()}</b> 自治体が該当</>
            ) : (
              <>上位 <b>{ranked.length}</b> 位を掲載</>
            )}
          </li>
          {freshness && <li className="rk-meta-pill"><ShieldCheck size={13} aria-hidden="true" />{freshness}</li>}
          <li className="rk-meta-pill"><Database size={13} aria-hidden="true" />政府統計の実データ</li>
        </ul>
        {def.note && (
          <p className="rk-lead rk-lead--note">{def.note}</p>
        )}
        {def.nextUpdate && (
          <p className="rk-lead rk-lead--note">
            📅 次回更新予定: {def.nextUpdate}
          </p>
        )}
        {(mapHub || def.related) && (
          <div className="rk-hero-actions">
            {mapHub && (
              <Link href={mapHub.href} className="rk-action rk-action-primary">
                <MapIcon size={15} aria-hidden="true" />{mapHub.label}で全国を見る
              </Link>
            )}
            {def.related && (
              <Link href={`/ranking/${def.related.slug}`} className="rk-action rk-action-ghost">
                <BarChart3 size={15} aria-hidden="true" />{def.related.label}
              </Link>
            )}
          </div>
        )}
      </header>

      {intro.length > 0 && (
        <section className="rk-section">
          <div className="rk-intro">
            {intro.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </section>
      )}

      <section className="rk-section">
        <div className="rk-section-head">
          <span className="rk-section-icon"><Trophy size={20} aria-hidden="true" /></span>
          <div className="rk-section-heading">
            <h2 className="rk-h2">
              {isList ? `該当する自治体（${def.columnLabel}が多い順）` : `トップ${Math.min(TOP_CARDS, ranked.length)}`}
            </h2>
            <p className="rk-section-sub">
              {isList
                ? `順位ではなく、条件に該当する自治体の一覧です（掲載順は${def.columnLabel}の多い順）。`
                : `${def.columnLabel}でみる上位。自治体名から住環境データの詳細へ。`}
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
                    <span className="rk-podium-pref">{prefNameOf(m.pref)}</span>
                    <span className="rk-podium-value">{def.display(m)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}

        {ladder.length > 0 && (
          <ol className="rk-ladder" start={4}>
            {ladder.map((m, i) => (
              <li key={m.code}>
                <Link href={`/area/${m.pref}/${m.code}`} className="rk-ladder-row">
                  <RankBadge className="rk-ladder-rank" isList={isList} rank={i + 4} />
                  <span className="rk-ladder-name">
                    {m.displayName ?? m.name}
                    <span className="rk-ladder-pref">{prefNameOf(m.pref)}</span>
                  </span>
                  <span className="rk-ladder-value">{def.display(m)}</span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="rk-section">
        <div className="rk-section-head">
          <span className="rk-section-icon"><BarChart3 size={20} aria-hidden="true" /></span>
          <div className="rk-section-heading">
            <h2 className="rk-h2">
              {isList
                ? `該当自治体の一覧（全${qualifiedCount.toLocaleString()}自治体のうち${ranked.length}件）`
                : `全国ランキング 上位${ranked.length}`}
            </h2>
            <p className="rk-section-sub">
              {isList
                ? `該当する全${qualifiedCount.toLocaleString()}自治体のうち、${def.columnLabel}が多い${ranked.length}件を掲載しています（順位ではありません）。横スクロールで全列を確認できます。`
                : `${def.columnLabel}の全順位表。横スクロールで全列を確認できます。`}
            </p>
          </div>
        </div>
        <div className="rk-table-wrap">
          <div className="pref-table-wrap">
            <table className="pref-table">
              <thead>
                <tr>
                  <th scope="col" className="num">{isList ? "掲載順" : "順位"}</th>
                  <th scope="col">自治体</th>
                  <th scope="col">都道府県</th>
                  <th scope="col" className="num">{def.columnLabel}</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((m, i) => (
                  <tr key={m.code}>
                    <td className="num">{i + 1}</td>
                    <th scope="row">
                      <Link href={`/area/${m.pref}/${m.code}`} className="pref-table-link">
                        {m.displayName ?? m.name}
                      </Link>
                    </th>
                    <td>
                      <Link href={`/area/${m.pref}`} className="pref-table-link pref-table-link--muted">
                        {prefNameOf(m.pref)}
                      </Link>
                    </td>
                    <td className="num">{def.display(m)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {prefsWithData.length > 0 && (
        <section className="rk-section">
          <div className="rk-section-head">
            <span className="rk-section-icon"><MapPin size={20} aria-hidden="true" /></span>
            <div className="rk-section-heading">
              <h2 className="rk-h2">都道府県別に見る</h2>
              <p className="rk-section-sub">{def.title}を都道府県ごとに絞り込めます。</p>
            </div>
          </div>
          <PrefRegionLinks
            href={(slug) => `/ranking/${def.slug}/${slug}`}
            linkClassName="pref-chip"
            gridClassName="pref-chip-grid"
            prefs={prefsWithData}
          />
        </section>
      )}

      <RankLinkList
        title="ほかのランキング"
        sub="同じ実データで、別の指標でも比べてみましょう。"
        rankings={others}
        href={(r) => `/ranking/${r.slug}`}
      />

      <RankFaq faq={faq} />

      <RankSources>{RANKING_SOURCES_TEXT}</RankSources>

      <nav className="rk-footnav" aria-label="関連リンク">
        <Link href="/ranking" className="rk-back"><ArrowLeft size={15} aria-hidden="true" />ランキング一覧</Link>
        <Link href="/map" className="rk-back"><MapIcon size={15} aria-hidden="true" />地図で探す</Link>
      </nav>
    </PageShell>
  );
}
