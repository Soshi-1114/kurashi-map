import "../league.css";
import "./denki.css";
import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Database } from "lucide-react";
import { SITE, absoluteUrl } from "@/lib/site";
import { DENKI_AREAS } from "@/lib/denki";
import { DENKI_PLANS } from "@/lib/denkiPlans";
import { HOUSEHOLD_KWH, HOUSEHOLD_KWH_SOURCE } from "@/lib/denkiSim";
import type { QA } from "@/lib/faq";
import DenkiSimulator from "@/components/denki/DenkiSimulator";
import PageShell from "@/components/PageShell";

// 電気料金シミュレーター。骨格・前提条件・FAQ は SSG の静的 HTML、入力状態は
// client island（DenkiSimulator）が持つ。?code= は自治体詳細ページからの
// プリセット導線で、canonical は常に /denki（クエリ付きは同一ページの状態）。
//
// honesty 方針: 試算は「目安」であり、燃料費調整額・再エネ賦課金・各種割引を
// 含まないことをページ内で必ず明示する。断定表現（「安くなります」）は使わない。

const TITLE = `電気代シミュレーション｜世帯人数から電力エリア別に料金目安を比較 - ${SITE.name}`;
const DESC =
  "世帯人数（または月間使用量kWh）から、全国10の電力エリア別に大手電力の従量電灯プランの月額目安を試算できます。単価は各社公式の料金表、使用量の目安は環境省の統計に基づき、燃料費調整額・再エネ賦課金は含みません。";

// 可視 FAQ と FAQPage 構造化データの単一ソース（ranking ページと同じ規約）。
const FAQ: QA[] = [
  {
    q: "試算額と実際の請求額が違うのはなぜですか？",
    a: "この試算には燃料費調整額と再エネ賦課金を含めていないためです。両者は毎月変動するため、固定の単価だけで計算できる範囲（基本料金・電力量料金）を比較の土台にしています。実際の請求額は各社の公式シミュレーションや検針票で確認してください。",
  },
  {
    q: "使用量の目安はどうやって決めていますか？",
    a: `${HOUSEHOLD_KWH_SOURCE.label}の世帯人数別の年間電気消費量を月平均に換算した全国値です（1人 ${HOUSEHOLD_KWH[1]}kWh 〜 5人 ${HOUSEHOLD_KWH[5]}kWh/月）。6人以上の世帯や実態と異なる場合は、使用量欄に kWh を直接入力してください。`,
  },
  {
    q: "供給エリアはどう決まりますか？",
    a: `全国${DENKI_AREAS.length}の一般送配電事業者の供給区域で決まり、都道府県とおおむね一致しますが、静岡県（富士川を境に東西）など県内で分かれる地域があります。該当する自治体から開いた場合はその旨を表示します。`,
  },
  {
    q: "掲載しているプランの選定基準は？",
    a: "比較の基準として各エリアの大手電力の従量電灯（規制料金）を掲載しています。今後掲載するプランも、公式の料金表で単価を確認できるものに限ります。",
  },
];

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: "/denki" },
  openGraph: {
    type: "website",
    url: absoluteUrl("/denki"),
    siteName: SITE.name,
    title: TITLE,
    description: DESC,
    images: [{ url: absoluteUrl("/api/og"), width: 1200, height: 630, alt: SITE.name }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC, images: [absoluteUrl("/api/og")] },
};

export default function DenkiPage() {
  const ldJson = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: SITE.name, item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: "電気代シミュレーション", item: absoluteUrl("/denki") },
        ],
      },
      {
        "@type": "WebApplication",
        name: "電気代シミュレーション",
        url: absoluteUrl("/denki"),
        applicationCategory: "UtilitiesApplication",
        operatingSystem: "Web",
        offers: { "@type": "Offer", price: "0", priceCurrency: "JPY" },
        description: DESC,
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
    <PageShell trail={[{ name: SITE.name, href: "/" }, { name: "電気代シミュレーション" }]}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldJson) }} />

      <header className="dnk-hero">
        <h1 className="dnk-title">電気代シミュレーション</h1>
        <p className="dnk-lead">
          お住まいの供給エリアと世帯人数を選ぶと、大手電力の従量電灯プランの月額目安を試算できます。使用量が分かる場合は検針票の kWh を入力するとより実態に近い目安になります。単価は各社公式の料金表（{DENKI_PLANS.asOf} 時点確認）に基づきます。
        </p>
      </header>

      <Suspense fallback={<p>読み込み中…</p>}>
        <DenkiSimulator />
      </Suspense>

      <section>
        <h2 className="h2 dnk-h2">試算の前提条件</h2>
        <div className="dnk-assumptions">
          <ul>
            <li>
              <strong>燃料費調整額・再生可能エネルギー発電促進賦課金は含みません。</strong>
              これらは毎月変動し、実際の請求額はこの試算と異なります。
            </li>
            <li>口座振替割引などの各種割引・キャンペーンは考慮していません。</li>
            <li>
              世帯人数別の使用量の目安は {HOUSEHOLD_KWH_SOURCE.label}（{HOUSEHOLD_KWH_SOURCE.asOf}）に基づきます。
              {HOUSEHOLD_KWH_SOURCE.note}です。住宅の種類や地域・季節によって実際の使用量は大きく変わります。
            </li>
            <li>
              料金単価は各社公式サイトの料金表を {DENKI_PLANS.asOf} 時点で確認した税込価格です。改定される場合があります。
            </li>
          </ul>
        </div>
      </section>

      <section>
        <h2 className="h2 dnk-h2">よくある質問</h2>
        <div className="rk-faq">
          {FAQ.map(({ q, a }, i) => (
            <details key={i} className="rk-faq-item">
              <summary className="rk-faq-q">{q}</summary>
              <p className="rk-faq-a">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <details className="rk-sources">
        <summary className="rk-sources-summary">
          <Database size={15} aria-hidden="true" />
          出典・データについて
        </summary>
        <p className="rk-sources-body">
          料金単価の出典:{" "}
          {DENKI_PLANS.plans.map((p, i) => (
            <span key={p.offerId}>
              {i > 0 && "・"}
              <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer">
                {p.company}「{p.planName}」
              </a>
            </span>
          ))}
          。使用量の目安:{" "}
          <a href={HOUSEHOLD_KWH_SOURCE.url} target="_blank" rel="noopener noreferrer">
            {HOUSEHOLD_KWH_SOURCE.label}
          </a>
          。エリア・自治体ごとの住みやすさデータは<Link href="/map">住みやすさマップ</Link>から確認できます。
        </p>
      </details>
    </PageShell>
  );
}
