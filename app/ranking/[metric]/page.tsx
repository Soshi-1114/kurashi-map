import "../../league.css";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  Trophy, BarChart3, MapPin, Info, Database, ArrowLeft, ArrowUpRight, Map as MapIcon, ShieldCheck,
} from "lucide-react";
import { listAllAcrossPrefs } from "@/lib/metrics";
import { RANKINGS, getRankingBySlug, muniLevelOnly, rankBy, type RankingDef } from "@/lib/rankings";
import { PREFS } from "@/lib/prefs";
import { SITE, prefNameOf, absoluteUrl } from "@/lib/site";
import PrefRegionLinks from "@/components/PrefRegionLinks";

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

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const def = getRankingBySlug(params.metric);
  if (!def) return { title: "見つかりません | KurashiMap" };
  const top = await rankedFor(def, 1);
  const top1 = top[0] ? `${prefNameOf(top[0].pref)}${top[0].displayName ?? top[0].name}` : "—";
  const freshness = def.freshnessLabel?.(top[0] ?? null) ?? null;
  const title = `${def.title}${freshness ? `【${freshness}】` : "【全国】"}｜${SITE.name}`;
  const description = def.metaDescription
    ? def.metaDescription(top[0] ?? null)
    : def.description.replace("{top1}", top1);
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

export default async function RankingPage({ params }: { params: Params }) {
  const def = getRankingBySlug(params.metric);
  if (!def) notFound();

  const allMunis = muniLevelOnly(await listAllAcrossPrefs());
  const ranked = rankBy(def, allMunis, TOP_TABLE);
  if (ranked.length === 0) notFound();
  const podium = ranked.slice(0, 3);          // トップ3＝順位台
  const ladder = ranked.slice(3, TOP_CARDS);  // 4位以降＝序列ラダー

  const others = RANKINGS.filter((r) => r.slug !== def.slug);
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
    <div className="rk-root">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldJson) }} />

      <nav aria-label="パンくず" className="breadcrumb">
        <Link href="/" className="breadcrumb-link">{SITE.name}</Link>
        <span aria-hidden="true">/</span>
        <Link href="/ranking" className="breadcrumb-link">ランキング</Link>
        <span aria-hidden="true">/</span>
        <span className="breadcrumb-current">{def.shortLabel}</span>
      </nav>

      <header className="rk-hero rk-reveal">
        <span className="rk-eyebrow"><Database size={14} aria-hidden="true" />全国ランキング</span>
        <h1 className="rk-title">{def.title}</h1>
        <p className="rk-lead">
          {def.lead}データのある自治体のみを対象に、政府統計の実データで集計しています（推計値は含みません）。
        </p>
        <ul className="rk-hero-meta">
          <li className="rk-meta-pill"><Trophy size={13} aria-hidden="true" />上位 <b>{ranked.length}</b> 位を掲載</li>
          {freshness && <li className="rk-meta-pill"><ShieldCheck size={13} aria-hidden="true" />{freshness}</li>}
          <li className="rk-meta-pill"><Database size={13} aria-hidden="true" />政府統計の実データ</li>
        </ul>
        {def.note && (
          <p className="rk-lead" style={{ fontSize: "var(--text-sm)", marginTop: 12 }}>{def.note}</p>
        )}
      </header>

      {intro.length > 0 && (
        <section className="rk-section">
          <div className="rk-intro">
            {intro.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            {def.compareForeignAvg && (
              <p>
                <Link href="/map/foreign-ratio">🗺 全国の外国人住民の割合を地図（コロプレス）で見る →</Link>
              </p>
            )}
          </div>
        </section>
      )}

      <section className="rk-section">
        <div className="rk-section-head">
          <span className="rk-section-icon"><Trophy size={20} aria-hidden="true" /></span>
          <div className="rk-section-heading">
            <h2 className="rk-h2">トップ{Math.min(TOP_CARDS, ranked.length)}</h2>
            <p className="rk-section-sub">{def.columnLabel}でみる上位。自治体名から住環境データの詳細へ。</p>
          </div>
        </div>

        {podium.length > 0 && (
          <ol className="rk-podium" aria-label="トップ3">
            {podium.map((m, i) => (
              <li key={m.code} style={{ display: "contents" }}>
                <Link href={`/area/${m.pref}/${m.code}`} className={`rk-podium-card is-${i + 1}`}>
                  <span className="rk-medal" aria-label={`${i + 1}位`}>{i + 1}</span>
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
                  <span className="rk-ladder-rank">{i + 4}</span>
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
            <h2 className="rk-h2">全国ランキング 上位{ranked.length}</h2>
            <p className="rk-section-sub">{def.columnLabel}の全順位表。横スクロールで全列を確認できます。</p>
          </div>
        </div>
        <div className="rk-table-wrap">
          <div className="pref-table-wrap">
            <table className="pref-table">
              <thead>
                <tr>
                  <th scope="col" className="num">順位</th>
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
                      <Link href={`/area/${m.pref}`} className="pref-table-link" style={{ fontWeight: 500 }}>
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

      <section className="rk-section">
        <div className="rk-section-head">
          <span className="rk-section-icon"><Trophy size={20} aria-hidden="true" /></span>
          <div className="rk-section-heading">
            <h2 className="rk-h2">ほかのランキング</h2>
            <p className="rk-section-sub">同じ実データで、別の指標でも比べてみましょう。</p>
          </div>
        </div>
        <ul className="rk-pill-grid">
          {others.map((r) => (
            <li key={r.slug}>
              <Link href={`/ranking/${r.slug}`} className="rk-pill">
                {r.title}
                <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {faq.length > 0 && (
        <section className="rk-section">
          <div className="rk-section-head">
            <span className="rk-section-icon"><Info size={20} aria-hidden="true" /></span>
            <div className="rk-section-heading">
              <h2 className="rk-h2">よくある質問</h2>
            </div>
          </div>
          <div className="rk-faq">
            {faq.map(({ q, a }, i) => (
              <details key={i} className="rk-faq-item">
                <summary className="rk-faq-q">{q}</summary>
                <p className="rk-faq-a">{a}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      <section className="rk-section">
        <details className="rk-sources">
          <summary className="rk-sources-summary">
            <Database size={15} aria-hidden="true" />出典・データについて
          </summary>
          <p className="rk-sources-body">
            家賃は住宅・土地統計調査、地価は地価公示・地価調査、待機児童はこども家庭庁の公表値、人口は国勢調査、外国人住民比率は出入国在留管理庁「在留外国人統計」に基づきます（e-Stat ほか）。政令指定都市の行政区は親市との重複を避けるため集計から除外しています。データのない自治体はランキングの対象外です。
          </p>
        </details>
      </section>

      <nav className="rk-footnav" aria-label="関連リンク">
        <Link href="/ranking" className="rk-back"><ArrowLeft size={15} aria-hidden="true" />ランキング一覧</Link>
        <Link href="/" className="rk-back"><MapIcon size={15} aria-hidden="true" />地図に戻る</Link>
      </nav>
    </div>
  );
}
