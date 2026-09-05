// 都道府県ランキング（47都道府県を1本に並べる）。
//
// URL は /ranking/{metric}/prefecture。同階層の [pref]（= /ranking/{metric}/{県}）は
// 動的セグメントだが、Next は静的セグメントを優先するのでこのページが勝つ。
// 「prefecture」は PREFS のスラッグに存在しないため衝突しない。
//
// 市区町村ランキングと違い、値は県内市区町村の **実数を合算** して作る
// （中央値ではない。理由と対象指標は lib/prefRankings.ts の冒頭コメント参照）。
// 集計方法とカバレッジ（対象N/全M自治体）を必ず本文に出すのが honesty 上の要件。

import "../../../league.css";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  Trophy, BarChart3, Database, ArrowLeft, Map as MapIcon, ShieldCheck, Info, Compass,
} from "lucide-react";
import { listAllAcrossPrefs } from "@/lib/metrics";
import { getRankingBySlug } from "@/lib/rankings";
import {
  PREF_RANKINGS,
  getPrefRankingBySlug,
  buildPrefRankingRows,
  type PrefRankingDef,
  type PrefRankingRow,
} from "@/lib/prefRankings";
import { SITE, absoluteUrl } from "@/lib/site";
import RankFaq from "@/components/RankFaq";
import RankSources, { RANKING_SOURCES_TEXT } from "@/components/RankSources";
import { RankBadge } from "@/components/RankBadge";
import PageShell from "@/components/PageShell";
import { FurusatoBand } from "@/components/monetization/FurusatoBand";
import { ShareButton } from "@/components/ShareButton";

type Params = { metric: string };

export function generateStaticParams() {
  return PREF_RANKINGS.map((r) => ({ metric: r.slug }));
}

async function rowsFor(def: PrefRankingDef): Promise<PrefRankingRow[]> {
  return buildPrefRankingRows(def, await listAllAcrossPrefs());
}

export async function generateMetadata(props: { params: Promise<Params> }): Promise<Metadata> {
  const params = await props.params;
  const def = getPrefRankingBySlug(params.metric);
  if (!def) return { title: "見つかりません | KurashiMap" };
  const rows = await rowsFor(def);
  const top = rows[0];
  // 「1位は◯◯」を title に先出しする（2026-08 の GSC 分析で、答えを先に出す title が
  // 質問型クエリの CTR に効くと判明したのと同じ方針）。
  const answer = top ? `｜1位は${top.prefName}` : "";
  const title = `${def.seoTitle ?? def.title}${answer}｜${SITE.name}`;
  const description = top
    ? `${def.title}。1位は${top.prefName}（${def.display(top.value)}）、最下位は${rows[rows.length - 1].prefName}（${def.display(rows[rows.length - 1].value)}）。${def.method}`
    : def.lead;
  const url = absoluteUrl(`/ranking/${def.slug}/prefecture`);
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
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PrefectureRankingPage(props: { params: Promise<Params> }) {
  const params = await props.params;
  const def = getPrefRankingBySlug(params.metric);
  if (!def) notFound();

  const all = await listAllAcrossPrefs();
  const rows = buildPrefRankingRows(def, all);
  if (rows.length === 0) notFound();

  const podium = rows.slice(0, 3);
  const source = def.sourceOf(all);
  // 対応する市区町村ランキング（同じ指標を自治体単位で見る導線）。
  const muniDef = getRankingBySlug(def.slug);
  // 全都道府県で対象外の自治体が1件もなければカバレッジ列は出さない（ノイズを減らす）。
  const showCoverage = rows.some((r) => r.covered < r.total);
  const others = PREF_RANKINGS.filter((r) => r.slug !== def.slug);

  const ldJson = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: SITE.name, item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: "ランキング", item: absoluteUrl("/ranking") },
          ...(muniDef
            ? [{ "@type": "ListItem", position: 3, name: muniDef.shortLabel, item: absoluteUrl(`/ranking/${def.slug}`) }]
            : []),
          {
            "@type": "ListItem",
            position: muniDef ? 4 : 3,
            name: def.shortLabel,
            item: absoluteUrl(`/ranking/${def.slug}/prefecture`),
          },
        ],
      },
      {
        "@type": "ItemList",
        name: def.title,
        numberOfItems: rows.length,
        itemListElement: rows.map((r, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: r.prefName,
          url: absoluteUrl(`/area/${r.prefSlug}`),
        })),
      },
      ...(def.faq && def.faq.length > 0
        ? [
            {
              "@type": "FAQPage",
              mainEntity: def.faq.map(({ q, a }) => ({
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
    <PageShell
      innerClassName="rk-root"
      trail={[
        { name: SITE.name, href: "/" },
        { name: "ランキング", href: "/ranking" },
        ...(muniDef ? [{ name: muniDef.shortLabel, href: `/ranking/${def.slug}` }] : []),
        { name: "都道府県別" },
      ]}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldJson) }} />

      <header className="rk-hero rk-reveal">
        <span className="rk-eyebrow"><Database size={14} aria-hidden="true" />都道府県ランキング</span>
        <h1 className="rk-title">{def.title}</h1>
        <p className="rk-lead">
          {def.lead}政府統計の実データのみで集計しています（推計値は含みません）。
        </p>
        <ul className="rk-hero-meta">
          <li className="rk-meta-pill">
            <Trophy size={13} aria-hidden="true" />
            <>全 <b>{rows.length}</b> 都道府県</>
          </li>
          {source && <li className="rk-meta-pill"><ShieldCheck size={13} aria-hidden="true" />{source}</li>}
          <li className="rk-meta-pill"><Database size={13} aria-hidden="true" />政府統計の実データ</li>
        </ul>
        <p className="rk-lead rk-lead--note">
          <Info size={14} aria-hidden="true" /> 集計方法: {def.method}
        </p>
        <div className="rk-hero-actions">
          {muniDef && (
            <Link href={`/ranking/${def.slug}`} className="rk-action rk-action-primary">
              <BarChart3 size={15} aria-hidden="true" />市区町村版を見る
            </Link>
          )}
          <Link href="/shindan?from=prefecture_ranking" className="rk-action rk-action-ghost">
            <Compass size={15} aria-hidden="true" />条件から街を診断する
          </Link>
          <ShareButton
            className="rk-action rk-action-ghost"
            title={`${def.title}｜${SITE.name}`}
            path={`/ranking/${def.slug}/prefecture`}
            contentType="pref_ranking"
            itemId={def.slug}
            label="共有する"
          />
        </div>
      </header>

      <section className="rk-section">
        <div className="rk-section-head">
          <span className="rk-section-icon"><Trophy size={20} aria-hidden="true" /></span>
          <div className="rk-section-heading">
            <h2 className="rk-h2">上位3都道府県</h2>
            <p className="rk-section-sub">{def.columnLabel}が{def.order === "desc" ? "高い" : "低い"}順です。</p>
          </div>
        </div>
        <ol className="rk-podium" aria-label="トップ3">
          {podium.map((r, i) => (
            // 順位台は CSS の order で並べ替えるため、li は display:contents で透過させる
            // （市区町村ランキングと同じ構造）。
            <li key={r.prefSlug} style={{ display: "contents" }}>
              <Link href={`/area/${r.prefSlug}`} className={`rk-podium-card is-${i + 1}`}>
                <RankBadge className="rk-medal" isList={false} rank={i + 1} rankAriaLabel={`${i + 1}位`} />
                <span className="rk-podium-body">
                  <span className="rk-podium-name">{r.prefName}</span>
                  <span className="rk-podium-value">{def.display(r.value)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="rk-section">
        <div className="rk-section-head">
          <span className="rk-section-icon"><BarChart3 size={20} aria-hidden="true" /></span>
          <div className="rk-section-heading">
            <h2 className="rk-h2">全{rows.length}都道府県の順位</h2>
            <p className="rk-section-sub">
              {def.columnLabel}の全順位表。
              {showCoverage && "「対象自治体」は、その指標のデータがある市区町村の数と県内の市区町村数です。"}
              横スクロールで全列を確認できます。
            </p>
          </div>
        </div>
        <div className="rk-table-wrap">
          <div className="pref-table-wrap">
            <table className="pref-table">
              <thead>
                <tr>
                  <th scope="col" className="num">順位</th>
                  <th scope="col">都道府県</th>
                  <th scope="col" className="num">{def.columnLabel}</th>
                  {showCoverage && <th scope="col" className="num">対象自治体</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.prefSlug}>
                    <td className="num">{i + 1}</td>
                    <th scope="row">
                      <Link href={`/area/${r.prefSlug}`} className="pref-table-link">
                        {r.prefName}
                      </Link>
                    </th>
                    <td className="num">{def.display(r.value)}</td>
                    {showCoverage && (
                      <td className="num">
                        {r.covered === r.total ? "全域" : `${r.covered} / ${r.total}`}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {others.length > 0 && (
        <section className="rk-section">
          <div className="rk-section-head">
            <span className="rk-section-icon"><MapIcon size={20} aria-hidden="true" /></span>
            <div className="rk-section-heading">
              <h2 className="rk-h2">ほかの都道府県ランキング</h2>
              <p className="rk-section-sub">同じ実データで、別の指標でも比べてみましょう。</p>
            </div>
          </div>
          <ul className="pref-chip-grid">
            {others.map((r) => (
              <li key={r.slug}>
                <Link href={`/ranking/${r.slug}/prefecture`} className="pref-chip">
                  {r.shortLabel}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <FurusatoBand />

      <RankFaq faq={def.faq ?? []} />

      <RankSources>{RANKING_SOURCES_TEXT}</RankSources>

      <nav className="rk-footnav" aria-label="関連リンク">
        {muniDef && (
          <Link href={`/ranking/${def.slug}`} className="rk-back">
            <ArrowLeft size={15} aria-hidden="true" />市区町村版
          </Link>
        )}
        <Link href="/ranking" className="rk-back"><Trophy size={15} aria-hidden="true" />ランキング一覧</Link>
        <Link href="/map" className="rk-back"><MapIcon size={15} aria-hidden="true" />地図で探す</Link>
      </nav>
    </PageShell>
  );
}
