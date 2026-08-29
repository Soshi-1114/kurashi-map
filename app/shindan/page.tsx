import "./shindan.css";
import Link from "next/link";
import type { Metadata } from "next";
import { listAllAcrossPrefs } from "@/lib/metrics";
import { muniLevelOnly } from "@/lib/rankings";
import { buildShindanEntries, SHINDAN_AXES } from "@/lib/shindan";
import { SITE, absoluteUrl } from "@/lib/site";
import ShindanClient from "@/components/shindan/ShindanClient";
import { ShareButton } from "@/components/ShareButton";
import PageShell from "@/components/PageShell";

// 街診断ページ。骨格（説明・FAQ・パンくず）は SSG の静的HTML、質問の回答状態は
// ?w=&r= のクエリとしてクライアント側で扱う（/compare と同方針）。
// スコアの軸はエリア詳細の住みやすさ5軸（lib/livabilityScore.ts）＋将来性で、
// 独自の新スコアは作らない（lib/shindan.ts 参照）。

const TITLE = `住む街診断｜重視する条件に合う市区町村を実データで探す - ${SITE.name}`;
const DESC =
  "家賃・アクセス・子育て・災害リスク・生活インフラ・将来性のうち重視する条件を選ぶと、全国の市区町村から条件に合う街トップ10を表示します。政府統計の実データのみで診断し、推計や主観のスコアは使いません。";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  metadataBase: new URL(SITE.baseUrl),
  alternates: { canonical: "/shindan" },
  openGraph: {
    type: "website",
    locale: SITE.locale,
    url: absoluteUrl("/shindan"),
    siteName: SITE.name,
    title: TITLE,
    description: DESC,
    images: [{ url: absoluteUrl("/api/og"), width: 1200, height: 630, alt: SITE.name }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC, images: [absoluteUrl("/api/og")] },
};

// 診断のFAQ（可視テキストと FAQPage 構造化データで同一ソースを共有）。
const FAQ = [
  {
    q: "診断のスコアはどうやって決まりますか？",
    a: "エリア詳細ページと同じ住みやすさ5軸（アクセス・家賃・子育て・災害・生活インフラ。政府統計の実データから固定のしきい値で算出）に将来性（2050年推計人口）を加えた6軸を、あなたが選んだ重みで平均した値です。主観のアンケートやAIによる評価は使っていません。",
  },
  {
    q: "表示されない自治体があるのはなぜですか？",
    a: "重視した条件の元データがない自治体（例: 家賃を重視した場合の住宅統計の集計対象外の町村）は、欠損を点数化せず結果から除外しています。条件を減らすと対象が広がります。",
  },
  {
    q: "大きな都市ばかりが上位に出ませんか？",
    a: "アクセス（駅数）と生活インフラ（医療・保育施設数）は施設の実数で測るため、規模の大きい自治体ほど高く出る傾向があります。この2つを「こだわらない」にすると、家賃・災害・将来性などの観点で小さな街も上位に入ります。",
  },
];

export default async function ShindanPage() {
  // 政令市の行政区は親市との重複を避けるため対象外（ランキングと同じ market-level）。
  const entries = buildShindanEntries(muniLevelOnly(await listAllAcrossPrefs()));

  const ldJson = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: SITE.name, item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: "住む街診断", item: absoluteUrl("/shindan") },
        ],
      },
      {
        "@type": "WebApplication",
        name: "住む街診断",
        url: absoluteUrl("/shindan"),
        applicationCategory: "UtilityApplication",
        operatingSystem: "Web",
        description: DESC,
        offers: { "@type": "Offer", price: "0", priceCurrency: "JPY" },
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ.map(({ q, a }) => ({
          "@type": "Question",
          name: q,
          acceptedAnswer: { "@type": "Answer", text: a },
        })),
      },
    ],
  };

  return (
    <PageShell trail={[{ name: SITE.name, href: "/" }, { name: "住む街診断" }]}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldJson) }} />

      <header>
        <h1 className="sd-title">住む街診断</h1>
        <p className="sd-lead">
          重視する条件を選ぶと、全国{entries.length.toLocaleString("ja-JP")}市区町村（政令指定都市は市単位）から条件に合う街トップ10を表示します。
          診断に使うのは{SHINDAN_AXES.map((a) => a.label).join("・")}の6軸。将来性のみ公的推計（国立社会保障・人口問題研究所の2050年推計）で、ほかの5軸は政府統計の実データから算出した目安です。主観のアンケートは使いません。
        </p>
        {/* path を渡さず現在のURL（?w=&r= の回答状態込み）を共有する */}
        <ShareButton
          className="sd-share"
          title={`住む街診断｜${SITE.name}`}
          contentType="shindan"
          itemId="shindan"
          label="この診断結果を共有"
        />
      </header>

      <ShindanClient entries={entries} />

      <section className="sd-faq-section">
        <h2 className="h2 sd-h2">よくある質問</h2>
        <div className="sd-faq">
          {FAQ.map(({ q, a }, i) => (
            <details key={i} className="sd-faq-item">
              <summary className="sd-faq-q">{q}</summary>
              <p className="sd-faq-a">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <p className="sd-foot">
        住みやすさ5軸の算出方法（しきい値）は
        <Link href="/about#score">「このサイトについて」</Link>
        で公開しています。将来性は2050年推計人口の増減率を、地図の塗り分けと同じ区分（0％以上／-10％まで／-30％まで／-50％まで／それ未満）で5段階にしたものです。診断結果は住みやすさを保証するものではなく、実データに基づく比較の目安です。気になった街は
        <Link href="/compare">比較ページ</Link>
        や<Link href="/map">地図</Link>でさらに詳しく確認できます。
      </p>
    </PageShell>
  );
}
