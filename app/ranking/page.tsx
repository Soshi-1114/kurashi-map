import "../league.css";
import Link from "next/link";
import type { Metadata } from "next";
import { Trophy, ArrowUpRight, Wallet, Home, JapaneseYen, Baby, Users, Globe2, ShieldCheck, TrendingUp, TrendingDown, Landmark, MapPin } from "lucide-react";
import { listAllAcrossPrefs } from "@/lib/metrics";
import { RANKINGS, muniLevelOnly, rankBy, type RankingDef } from "@/lib/rankings";
import { PREF_RANKINGS, buildPrefRankingRows } from "@/lib/prefRankings";
import { SITE, prefNameOf, absoluteUrl } from "@/lib/site";
import { RankBadge } from "@/components/RankBadge";
import PageShell from "@/components/PageShell";

export function generateMetadata(): Metadata {
  const title = `住みやすさ・家賃ランキング一覧｜全国の市区町村を比較｜${SITE.name}`;
  const description = `家賃が安い／高い、地価が高い、待機児童ゼロなど、全国の市区町村を政府統計の実データで比較できるランキング一覧。${SITE.name}。`;
  const url = absoluteUrl("/ranking");
  const ogImage = absoluteUrl("/api/og");
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
      images: [{ url: ogImage, width: 1200, height: 630, alt: SITE.name }],
    },
    twitter: { card: "summary_large_image", title, description, images: [ogImage] },
  };
}

// 指標スラッグ → アイコン＋トーン（カテゴリ配色はエリア詳細と統一）。
const RANK_VISUAL: Record<string, { Icon: typeof Wallet; tone: string }> = {
  "rent-cheap": { Icon: Wallet, tone: "rk-tone-rent" },
  "rent-high": { Icon: Home, tone: "rk-tone-rent" },
  "land-price-high": { Icon: JapaneseYen, tone: "rk-tone-land" },
  "land-price-low": { Icon: JapaneseYen, tone: "rk-tone-land" },
  "waitlist-zero": { Icon: Baby, tone: "rk-tone-kids" },
  "childcare-capacity": { Icon: Baby, tone: "rk-tone-kids" },
  "population-most": { Icon: Users, tone: "rk-tone-pop" },
  "population-growth": { Icon: TrendingUp, tone: "rk-tone-pop" },
  "population-decline": { Icon: TrendingDown, tone: "rk-tone-pop" },
  "aging-high": { Icon: Users, tone: "rk-tone-pop" },
  "aging-low": { Icon: Users, tone: "rk-tone-pop" },
  "foreign-ratio-high": { Icon: Globe2, tone: "rk-tone-foreign" },
  "foreign-ratio-low": { Icon: Globe2, tone: "rk-tone-foreign" },
  "fiscal-strong": { Icon: Landmark, tone: "rk-tone-infra" },
  "fiscal-weak": { Icon: Landmark, tone: "rk-tone-infra" },
};
function visualFor(slug: string) {
  return RANK_VISUAL[slug] ?? { Icon: Trophy, tone: "rk-tone-rent" };
}

export default async function RankingIndexPage() {
  const all = await listAllAcrossPrefs();
  const munis = muniLevelOnly(all);
  // 各ランキングの1位を添えて、一覧をリッチに（クロール用の内部リンクも厚くなる）
  const cards: { def: RankingDef; top1: ReturnType<typeof rankBy>[number] | null }[] = RANKINGS.map((def) => {
    const top1 = rankBy(def, munis, 1)[0] ?? null;
    return { def, top1 };
  });
  // 都道府県ランキング（47都道府県を並べる別ページ型）。ここが唯一のハブなので、
  // 一覧に載せないと新規URLの入口が各指標のヒーローCTA1本だけになってしまう。
  const prefCards = PREF_RANKINGS.map((def) => ({ def, top1: buildPrefRankingRows(def, all)[0] ?? null }));

  const ldJson = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: SITE.name, item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: "ランキング", item: absoluteUrl("/ranking") },
        ],
      },
      {
        "@type": "ItemList",
        name: "住みやすさ・家賃ランキング一覧",
        numberOfItems: RANKINGS.length + PREF_RANKINGS.length,
        itemListElement: [
          ...RANKINGS.map((r, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: r.title,
            url: absoluteUrl(`/ranking/${r.slug}`),
          })),
          ...PREF_RANKINGS.map((r, i) => ({
            "@type": "ListItem",
            position: RANKINGS.length + i + 1,
            name: r.title,
            url: absoluteUrl(`/ranking/${r.slug}/prefecture`),
          })),
        ],
      },
    ],
  };

  return (
    <PageShell innerClassName="rk-root" trail={[{ name: SITE.name, href: "/" }, { name: "ランキング" }]}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldJson) }} />


      <header className="rk-hero rk-reveal">
        <span className="rk-eyebrow"><Trophy size={14} aria-hidden="true" />政府統計の実データで比較</span>
        <h1 className="rk-title">
          住みやすさ・家賃ランキング
          <span className="rk-title-sub">全国 {munis.length.toLocaleString()} 市区町村を横断比較</span>
        </h1>
        <p className="rk-lead">
          家賃・地価・子育て・人口などの指標ごとに、全国の市区町村を実データでランキング。
          各カードはいまの<strong>1位</strong>（該当自治体の一覧型は該当例）を示しています。気になる指標を選んでください。
          集計対象は{munis.length.toLocaleString()}自治体で、政令指定都市の行政区は親市との重複を避けるため除外しています。
        </p>
        <ul className="rk-hero-meta">
          <li className="rk-meta-pill"><Trophy size={13} aria-hidden="true" /><b>{RANKINGS.length}</b> 種類の指標</li>
          <li className="rk-meta-pill"><MapPin size={13} aria-hidden="true" />都道府県版 <b>{PREF_RANKINGS.length}</b> 種類</li>
          <li className="rk-meta-pill"><ShieldCheck size={13} aria-hidden="true" />推計値なし・出典明記</li>
        </ul>
      </header>

      <section className="rk-section">
        <div className="rk-section-head">
          <span className="rk-section-icon"><Trophy size={20} aria-hidden="true" /></span>
          <div className="rk-section-heading">
            <h2 className="rk-h2">指標を選ぶ</h2>
            <p className="rk-section-sub">各指標の現在の1位自治体つき。カードを選ぶと全国ランキングへ。</p>
          </div>
        </div>

        <ul className="rk-champ-grid">
          {cards.map(({ def, top1 }) => {
            const { Icon, tone } = visualFor(def.slug);
            return (
              <li key={def.slug}>
                <Link href={`/ranking/${def.slug}`} className="rk-champ">
                  <div className="rk-champ-head">
                    <span className={`rk-champ-icon ${tone}`}><Icon size={20} aria-hidden="true" /></span>
                    <span className="rk-champ-title">{def.title}</span>
                    <ArrowUpRight size={18} className="rk-champ-arrow" aria-hidden="true" />
                  </div>
                  {top1 && (
                    <div className="rk-champ-winner">
                      <RankBadge
                        className="rk-champ-medal"
                        isList={def.membershipList}
                        rank={1}
                        rankAriaLabel="1位"
                        checkAriaLabel="該当自治体の例"
                      />
                      <span className="rk-champ-winner-body">
                        <span className="rk-champ-town">
                          {top1.displayName ?? top1.name}
                          <small>{prefNameOf(top1.pref)}</small>
                        </span>
                        <span className="rk-champ-value">{def.display(top1)}</span>
                      </span>
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rk-section">
        <div className="rk-section-head">
          <span className="rk-section-icon"><MapPin size={20} aria-hidden="true" /></span>
          <div className="rk-section-heading">
            <h2 className="rk-h2">都道府県で比べる</h2>
            <p className="rk-section-sub">
              市区町村ではなく、47都道府県を並べたランキングです。県の値は公表値、または県内市区町村の実数を合算して求めています。
            </p>
          </div>
        </div>

        <ul className="rk-champ-grid">
          {prefCards.map(({ def, top1 }) => {
            const { Icon, tone } = visualFor(def.slug);
            return (
              <li key={def.slug}>
                <Link href={`/ranking/${def.slug}/prefecture`} className="rk-champ">
                  <div className="rk-champ-head">
                    <span className={`rk-champ-icon ${tone}`}><Icon size={20} aria-hidden="true" /></span>
                    <span className="rk-champ-title">{def.title}</span>
                    <ArrowUpRight size={18} className="rk-champ-arrow" aria-hidden="true" />
                  </div>
                  {top1 && (
                    <div className="rk-champ-winner">
                      <RankBadge className="rk-champ-medal" isList={false} rank={1} rankAriaLabel="1位" />
                      <span className="rk-champ-winner-body">
                        <span className="rk-champ-town">{top1.prefName}</span>
                        <span className="rk-champ-value">{def.display(top1.value)}</span>
                      </span>
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <nav className="rk-footnav" aria-label="関連リンク">
        <Link href="/map" className="rk-back">← 地図で探す</Link>
      </nav>
    </PageShell>
  );
}
