// サイトについて・データの出典と更新方針。E-E-A-T（運営の透明性）と
// 「◯◯ データ 出典」系クエリの受け皿を兼ねるページ。
// 基準時点はビルド時に実データ（サンプル自治体の asOf）から取り、表示と実データの
// 乖離を防ぐ（誠実性方針）。次回更新予定は lib/rankings の NEXT_UPDATE と同期。

import Link from "next/link";
import type { Metadata } from "next";
import { getMunicipality } from "@/lib/metrics";
import { NEXT_UPDATE, formatAsOfJa } from "@/lib/rankings";
import { SITE, absoluteUrl } from "@/lib/site";

const PATH = "/about";
const TITLE = `${SITE.name}について｜データの出典と更新方針`;
const DESC =
  "KurashiMapは全国1,918市区町村の住みやすさ関連データを地図で比較できる無料サービスです。全データの出典（政府統計）・基準時点・更新頻度・次回更新予定と、推計値を使わない運営方針を公開しています。";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  metadataBase: new URL(SITE.baseUrl),
  alternates: { canonical: PATH },
  openGraph: {
    type: "website",
    locale: SITE.locale,
    url: absoluteUrl(PATH),
    title: TITLE,
    description: DESC,
    siteName: SITE.name,
    images: [{ url: absoluteUrl("/api/og"), width: 1200, height: 630, alt: SITE.name }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC },
};

type SourceRow = {
  label: string;
  source: string;
  asOf: string;
  cycle: string;
  next?: string;
};

// 基準時点はサンプル自治体（さいたま市）の実データ asOf から取得する。
// 全自治体で同一期のデータを収録しているため、1件で代表できる。
async function loadRows(): Promise<SourceRow[]> {
  const m = await getMunicipality("11100");
  if (!m) return [];
  return [
    {
      label: "家賃（民営借家中央値）",
      source: "総務省 住宅・土地統計調査（e-Stat）",
      asOf: formatAsOfJa(m.rent.asOf),
      cycle: "5年ごと",
      next: NEXT_UPDATE.rent,
    },
    {
      label: "地価（住宅地平均）",
      source: "国土交通省 地価公示（国土数値情報 L01）",
      asOf: formatAsOfJa(m.landPrice.asOf),
      cycle: "年1回（1月1日時点・3月公表）",
      next: NEXT_UPDATE.landPrice,
    },
    {
      label: "人口・人口増減率",
      source: "総務省 国勢調査（e-Stat）",
      asOf: "2025年（速報集計）",
      cycle: "5年ごと",
      next: NEXT_UPDATE.population,
    },
    {
      label: "待機児童数",
      source: "こども家庭庁 保育所等関連状況取りまとめ",
      asOf: formatAsOfJa(m.waitlistChildren.asOf),
      cycle: "年1回（4月1日時点・夏〜秋公表）",
      next: NEXT_UPDATE.waitlist,
    },
    {
      label: "在留外国人数・比率",
      source: "出入国在留管理庁 在留外国人統計（e-Stat）",
      asOf: formatAsOfJa(m.foreignResidents.asOf),
      cycle: "年2回（6月末・12月末時点）",
      next: NEXT_UPDATE.foreign,
    },
    {
      label: "災害リスク（浸水・土砂・津波・高潮・液状化）",
      source: "国土数値情報（不動産情報ライブラリ経由）",
      asOf: formatAsOfJa(m.hazard.asOf),
      cycle: "四半期ごとに再取得（出典の更新は随時）",
    },
    {
      label: "生活インフラ（駅・保育/幼稚園・医療機関）",
      source: "国土数値情報 S12・不動産情報ライブラリ・厚生労働省 医療施設調査",
      asOf: m.amenities?.asOf ?? "-",
      cycle: "年1回（駅・医療）／四半期（保育）",
    },
    {
      label: "指定緊急避難場所",
      source: "国土地理院 指定緊急避難場所データ",
      asOf: formatAsOfJa(m.shelters?.asOf ?? "-"),
      cycle: "年1回（出典の更新は随時）",
    },
  ];
}

export default async function AboutPage() {
  const rows = await loadRows();

  const ldJson = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: SITE.name, item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: `${SITE.name}について`, item: absoluteUrl(PATH) },
        ],
      },
      {
        "@type": "AboutPage",
        name: TITLE,
        url: absoluteUrl(PATH),
        description: DESC,
        about: { "@type": "WebSite", name: SITE.name, url: SITE.baseUrl },
      },
    ],
  };

  return (
    <div className="detail-root">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ldJson) }} />

      <nav aria-label="パンくず" className="breadcrumb">
        <Link href="/" className="breadcrumb-link">{SITE.name}</Link>
        <span aria-hidden="true">/</span>
        <span className="breadcrumb-current">このサイトについて</span>
      </nav>

      <header className="detail-hero">
        <h1 className="detail-title">{SITE.name}について</h1>
        <p className="detail-lead">
          {SITE.name}は、全国47都道府県・1,918市区町村の住みやすさ関連データ（家賃・地価・人口・子育て・災害リスク・生活インフラ・在留外国人）を、地図とランキングで比較できる無料のWebサービスです。
        </p>
      </header>

      <section className="detail-section">
        <h2 className="detail-h2">データの方針（推計値を使いません）</h2>
        <p className="detail-p">
          掲載する数値はすべて政府統計・公的機関の公表データ（実データ）です。<strong>推計値・補完値は一切使用しません。</strong>出典にデータが無い自治体は、それらしい数値で埋めるのではなく「データなし」「対象外」「非公表」と明示します（例: 住宅統計の集計対象外の小規模町村、地価公示の標準地が無い自治体、北方領土6村など）。
        </p>
        <p className="detail-p">
          各指標には基準時点（出典の調査年月）を必ず併記し、出典の公表サイクルに合わせて更新しています。方針として、同じ指標が複数の公的ソースから得られる場合は、基準時点がより新しいソースを優先します。なお、治安・犯罪に関するデータは扱いません。
        </p>
      </section>

      <section className="detail-section">
        <h2 className="detail-h2">データの出典・基準時点・更新予定</h2>
        <div className="pref-table-wrap">
          <table className="pref-table">
            <thead>
              <tr>
                <th scope="col">指標</th>
                <th scope="col">出典</th>
                <th scope="col">基準時点</th>
                <th scope="col">更新サイクル</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <th scope="row">{r.label}</th>
                  <td>{r.source}</td>
                  <td>{r.asOf}</td>
                  <td>{r.cycle}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3 className="detail-h2" style={{ fontSize: 16, marginTop: 20 }}>次回の更新予定</h3>
        <ul className="detail-p" style={{ paddingLeft: "1.2em" }}>
          <li>在留外国人: {NEXT_UPDATE.foreign}</li>
          <li>人口: {NEXT_UPDATE.population}</li>
          <li>待機児童: {NEXT_UPDATE.waitlist}</li>
          <li>地価: {NEXT_UPDATE.landPrice}</li>
          <li>家賃: {NEXT_UPDATE.rent}</li>
        </ul>
      </section>

      <section className="detail-section">
        <h2 className="detail-h2">免責事項</h2>
        <p className="detail-p" style={{ fontSize: 13, color: "var(--text-muted)" }}>
          本サイトの情報は、住まい選びの参考情報として公的統計を整理・可視化したものであり、内容の完全性・正確性・最新性を保証するものではありません。統計の基準時点以降に状況が変わっている場合があります。重要な判断（契約・購入など）の際は、必ず各自治体・出典元の一次情報をご確認ください。本サイトの利用により生じた損害について、運営者は責任を負いかねます。
        </p>
      </section>

      <section className="detail-section">
        <h2 className="detail-h2">運営</h2>
        <p className="detail-p">
          {SITE.name}は個人が運営する無料の情報サービスです。データの誤りにお気づきの場合は、該当ページと出典をあわせてご指摘いただければ、一次情報を確認のうえ速やかに修正します。
        </p>
      </section>

      <div style={{ marginTop: 28, display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Link href="/" className="detail-back">地図で見る</Link>
        <Link href="/ranking" className="detail-back">ランキング一覧</Link>
        <Link href="/privacy" className="detail-back">プライバシーポリシー</Link>
      </div>
    </div>
  );
}
