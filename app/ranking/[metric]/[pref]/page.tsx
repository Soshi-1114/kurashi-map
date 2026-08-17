import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listMunicipalities } from "@/lib/metrics";
import { RANKINGS, getRankingBySlug, rankBy, medianOf, appendFreshness, type RankingDef } from "@/lib/rankings";
import { getRankPositions, getNationalMedians } from "@/lib/rankingStats";
import { PREFS, getPrefBySlug } from "@/lib/prefs";
import { SITE, absoluteUrl } from "@/lib/site";
import { getForeignStats } from "@/lib/foreignStats";
import { countWaitlistDisclosed } from "@/lib/waitlist";
import { RankBadge } from "@/components/RankBadge";
import type { Municipality } from "@/lib/types";
import PageShell from "@/components/PageShell";

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
  const title = `${pref.nameJa}の${def.seoTitle ?? def.title}${fresh}｜市区町村を比較｜${SITE.name}`;
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
  const cards = ranked.slice(0, TOP_CARDS);
  const prefName = pref.nameJa;

  // データ鮮度ラベル・導入文・FAQ（定義のある指標のみ）。
  const freshness = def.freshnessLabel?.(ranked[0] ?? null) ?? null;
  const headingSub = freshness ? `【${freshness}】` : null;
  const intro = def.prefIntro?.(prefName) ?? [];
  const faq = def.faq ?? [];

  // 県内サマリー（県内中央値・全国対比・県内1位の全国順位）。membershipList 型は
  // 値の分布を持たないため、「公表対象のうち該当n自治体」の要約に切り替える。
  const summary = await prefSummaryFor(def, ranked);
  const waitlistDisclosed = def.membershipList ? countWaitlistDisclosed(munis) : null;

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
    <PageShell trail={[{ name: SITE.name, href: "/" }, { name: "ランキング", href: "/ranking" }, { name: def.shortLabel, href: `/ranking/${def.slug}` }, { name: prefName }]}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldJson) }} />


      <header className="detail-hero">
        <h1 className="detail-title">
          {prefName}の{def.title}
          {headingSub && <span className="detail-title-sub">{headingSub}</span>}
        </h1>
        <p className="detail-lead">
          {def.lead.replace("全国の", `${prefName}の`)}データのある{ranked.length}市区町村を、政府統計の実データで集計しています（推計値は含みません）。
        </p>
        {def.note && <p className="detail-note">{def.note}</p>}
        {def.nextUpdate && <p className="detail-note">📅 次回更新予定: {def.nextUpdate}</p>}
        <div className="detail-inline-links">
          <Link href={`/ranking/${def.slug}`} className="related-card related-card--inline">
            <span className="related-name">📊 全国版を見る</span>
          </Link>
          <Link href={`/area/${pref.slug}`} className="related-card related-card--inline">
            <span className="related-name">🗾 {prefName}の全自治体</span>
          </Link>
        </div>
      </header>

      {(summary || waitlistDisclosed !== null) && (
        <section className="detail-section">
          <h2 className="detail-h2">{prefName}のデータ概況</h2>
          {summary ? (
            <>
              <p className="detail-p">
                {prefName}内で集計対象となる{ranked.length}市区町村のうち、県内中央値は
                {def.display(summary.prefMedian)}（{summary.prefMedian.displayName ?? summary.prefMedian.name}）で、
                全国中央値{def.display(summary.nationalMedian)}と比べて{summary.vsNational}です。
                県内1位の{cards[0].displayName ?? cards[0].name}（{def.display(cards[0])}）は、
                全国{summary.nationalCount.toLocaleString()}自治体中{summary.top1NationalRank.toLocaleString()}位に相当します。
                県内の値の幅は{def.display(summary.rangeLow)}〜{def.display(summary.rangeHigh)}です。
              </p>
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
                  <p className="mini-card-sub">全国{summary.nationalCount.toLocaleString()}自治体中（{cards[0].displayName ?? cards[0].name}）</p>
                </li>
              </ul>
            </>
          ) : (
            <p className="detail-p">
              {prefName}では、待機児童数が公表されている{waitlistDisclosed}自治体のうち
              {ranked.length}自治体が待機児童ゼロです（人口が多い順に掲載）。
            </p>
          )}
        </section>
      )}

      {intro.length > 0 && (
        <section className="detail-intro">
          {intro.map((p, i) => (
            <p key={i} className="detail-p">{p}</p>
          ))}
        </section>
      )}

      {benchmark && (
        <section className="detail-section">
          <h2 className="detail-h2">ベンチマーク（平均との比較）</h2>
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

      <section className="detail-section">
        <h2 className="detail-h2">
          {def.membershipList ? `該当する自治体（${def.columnLabel}が多い順）` : `トップ${cards.length}`}
        </h2>
        <ol className="pref-rank">
          {cards.map((m, i) => (
            <li key={m.code}>
              <Link href={`/area/${m.pref}/${m.code}`} className="pref-rank-item">
                <RankBadge className="pref-rank-no" isList={def.membershipList} rank={i + 1} />
                <span className="pref-rank-name">{m.displayName ?? m.name}</span>
                <span className="pref-rank-value">{def.display(m)}</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="detail-section">
        <h2 className="detail-h2">
          {def.membershipList
            ? `${prefName}の該当自治体一覧（${ranked.length}自治体）`
            : `${prefName}の全ランキング（${ranked.length}自治体）`}
        </h2>
        <div className="pref-table-wrap">
          <table className="pref-table">
            <thead>
              <tr>
                <th scope="col" className="num">{def.membershipList ? "掲載順" : "順位"}</th>
                <th scope="col">自治体</th>
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
                  <td className="num">{def.display(m)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {otherMetrics.length > 0 && (
        <section className="detail-section">
          <h2 className="detail-h2">{prefName}のほかのランキング</h2>
          <ul className="related-grid">
            {otherMetrics.map((r) => (
              <li key={r.slug}>
                <Link href={`/ranking/${r.slug}/${pref.slug}`} className="related-card">
                  <span className="related-name">{prefName}の{r.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {faq.length > 0 && (
        <section className="detail-section">
          <h2 className="detail-h2">よくある質問</h2>
          <dl className="faq-list">
            {faq.map(({ q, a }, i) => (
              <div key={i} className="faq-item">
                <dt className="faq-q">{q}</dt>
                <dd className="faq-a">{a}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="detail-section">
        <h2 className="detail-h2">出典・データについて</h2>
        <p className="detail-p detail-p-muted">
          家賃は住宅・土地統計調査、地価は地価公示・地価調査、待機児童はこども家庭庁の公表値、人口は国勢調査、外国人住民比率は出入国在留管理庁「在留外国人統計」に基づきます（e-Stat ほか）。政令指定都市の行政区は親市との重複を避けるため集計から除外しています。データのない自治体はランキングの対象外です。
        </p>
      </section>

      <div className="detail-footnav">
        <Link href={`/ranking/${def.slug}`} className="detail-back">← 全国版</Link>
        <Link href="/ranking" className="detail-back">ランキング一覧</Link>
        <Link href={`/area/${pref.slug}`} className="detail-back">{prefName}の一覧</Link>
      </div>
    </PageShell>
  );
}
