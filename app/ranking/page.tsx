import "../league.css";
import Link from "next/link";
import type { Metadata } from "next";
import { Trophy, ArrowUpRight, Wallet, Home, JapaneseYen, Baby, Users, Globe2, ShieldCheck } from "lucide-react";
import { listAllAcrossPrefs } from "@/lib/metrics";
import { RANKINGS, muniLevelOnly, rankBy, type RankingDef } from "@/lib/rankings";
import { SITE, prefNameOf, absoluteUrl } from "@/lib/site";

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
  "waitlist-zero": { Icon: Baby, tone: "rk-tone-kids" },
  "population-most": { Icon: Users, tone: "rk-tone-pop" },
  "foreign-ratio-high": { Icon: Globe2, tone: "rk-tone-foreign" },
  "foreign-ratio-low": { Icon: Globe2, tone: "rk-tone-foreign" },
};
function visualFor(slug: string) {
  return RANK_VISUAL[slug] ?? { Icon: Trophy, tone: "rk-tone-rent" };
}

export default async function RankingIndexPage() {
  const munis = muniLevelOnly(await listAllAcrossPrefs());
  // 各ランキングの1位を添えて、一覧をリッチに（クロール用の内部リンクも厚くなる）
  const cards: { def: RankingDef; top1: ReturnType<typeof rankBy>[number] | null }[] = RANKINGS.map((def) => {
    const top1 = rankBy(def, munis, 1)[0] ?? null;
    return { def, top1 };
  });

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
        numberOfItems: RANKINGS.length,
        itemListElement: RANKINGS.map((r, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: r.title,
          url: absoluteUrl(`/ranking/${r.slug}`),
        })),
      },
    ],
  };

  return (
    <div className="rk-root">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldJson) }} />

      <nav aria-label="パンくず" className="breadcrumb">
        <Link href="/" className="breadcrumb-link">{SITE.name}</Link>
        <span aria-hidden="true">/</span>
        <span className="breadcrumb-current">ランキング</span>
      </nav>

      <header className="rk-hero rk-reveal">
        <span className="rk-eyebrow"><Trophy size={14} aria-hidden="true" />政府統計の実データで比較</span>
        <h1 className="rk-title">
          住みやすさ・家賃ランキング
          <span className="rk-title-sub">全国 1,918 市区町村を横断比較</span>
        </h1>
        <p className="rk-lead">
          家賃・地価・子育て・人口などの指標ごとに、全国の市区町村を実データでランキング。
          各カードはいまの<strong>1位</strong>を示しています。気になる指標を選んでください。
        </p>
        <ul className="rk-hero-meta">
          <li className="rk-meta-pill"><Trophy size={13} aria-hidden="true" /><b>{RANKINGS.length}</b> 種類の指標</li>
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
                      <span className="rk-champ-medal" aria-label="1位">1</span>
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

      <nav className="rk-footnav" aria-label="関連リンク">
        <Link href="/" className="rk-back">← 地図に戻る</Link>
      </nav>
    </div>
  );
}
