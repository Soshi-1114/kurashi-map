// 指標別 地図ハブ（ピラーページ）の共通テンプレート。/map/foreign-ratio と同じ構成
// （全国コロプレス初期表示＋ランキング・県別・自治体ページへの放射リンク）を、
// 家賃・地価・人口増減などへ横展開するための server component 群。
// ページ側は MetricHubConfig を組み立てて hubMetadata / hubLdJson / MetricMapHubBody を使う。

import Link from "next/link";
import type { Metadata } from "next";
import PrefRegionLinks from "@/components/PrefRegionLinks";
import type { PREFS } from "@/lib/prefs";
import { SITE, prefNameOf, absoluteUrl } from "@/lib/site";
import type { Municipality } from "@/lib/types";

export type HubSection = {
  heading: string;
  entries: { m: Municipality; valueText: string }[];
};

export type MetricHubConfig = {
  path: string; // 例 "/map/rent"
  title: string;
  description: string;
  ogImage: string; // 既存の /api/og/ranking/{slug} を流用
  ogAlt: string;
  h1: string;
  /** リード段落（データの説明・出典・中立性など）。 */
  leads: string[];
  /** 「📅 次回更新予定: …」の文（lib/rankings NEXT_UPDATE を渡す）。 */
  nextUpdate?: string;
  rankingLinks: { href: string; label: string }[];
  sections: HubSection[];
  prefsWithData: typeof PREFS;
  prefHref: (slug: string) => string;
  foot: string;
  dataset: { name: string; description: string; keywords: string[]; temporalCoverage?: string };
};

export function hubMetadata(cfg: MetricHubConfig): Metadata {
  return {
    title: cfg.title,
    description: cfg.description,
    metadataBase: new URL(SITE.baseUrl),
    alternates: { canonical: cfg.path },
    openGraph: {
      type: "website",
      locale: SITE.locale,
      url: absoluteUrl(cfg.path),
      title: cfg.title,
      description: cfg.description,
      siteName: SITE.name,
      images: [{ url: cfg.ogImage, width: 1200, height: 630, alt: cfg.ogAlt }],
    },
    twitter: { card: "summary_large_image", title: cfg.title, description: cfg.description, images: [cfg.ogImage] },
  };
}

export function hubLdJson(cfg: MetricHubConfig) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: SITE.name, item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: cfg.h1, item: absoluteUrl(cfg.path) },
        ],
      },
      {
        "@type": "Dataset",
        name: cfg.dataset.name,
        description: cfg.dataset.description,
        url: absoluteUrl(cfg.path),
        keywords: cfg.dataset.keywords,
        isAccessibleForFree: true,
        creator: { "@type": "Organization", name: SITE.name, url: SITE.baseUrl },
        includedInDataCatalog: { "@type": "DataCatalog", name: "e-Stat 政府統計の総合窓口", url: "https://www.e-stat.go.jp/" },
        spatialCoverage: { "@type": "Place", name: "日本" },
        ...(cfg.dataset.temporalCoverage ? { temporalCoverage: cfg.dataset.temporalCoverage } : {}),
      },
    ],
  };
}

export function MetricMapHubBody(cfg: MetricHubConfig) {
  return (
    <div className="home-links-inner">
      <h1 className="home-links-lead-title">{cfg.h1}</h1>
      {cfg.leads.map((p, i) => (
        <p key={i} className="home-links-lead">{p}</p>
      ))}
      {cfg.nextUpdate && <p className="home-links-lead">📅 次回更新予定: {cfg.nextUpdate}</p>}

      <section className="home-links-block">
        <h2 className="home-links-h">ランキングで比較</h2>
        <ul className="home-chip-row">
          {cfg.rankingLinks.map((l) => (
            <li key={l.href}><Link href={l.href} className="home-chip">{l.label}</Link></li>
          ))}
        </ul>
      </section>

      {cfg.sections.map(
        (sec) =>
          sec.entries.length > 0 && (
            <section key={sec.heading} className="home-links-block">
              <h2 className="home-links-h">{sec.heading}</h2>
              <ul className="home-chip-row">
                {sec.entries.map(({ m, valueText }) => (
                  <li key={m.code}>
                    <Link href={`/area/${m.pref}/${m.code}`} className="home-chip">
                      {prefNameOf(m.pref)}{m.displayName ?? m.name}（{valueText}）
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ),
      )}

      <section className="home-links-block">
        <h2 className="home-links-h">都道府県別に見る</h2>
        <PrefRegionLinks
          href={cfg.prefHref}
          linkClassName="home-pref-link"
          gridClassName="home-pref-grid"
          prefs={cfg.prefsWithData}
        />
      </section>

      <p className="home-links-foot">{cfg.foot}</p>
    </div>
  );
}
