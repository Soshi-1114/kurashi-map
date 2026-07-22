// プライバシーポリシー。GA4（gtag.js）による閲覧計測の開示を主目的とし、
// Cookie・外部送信・第三者提供・外部リンクの扱いを明示する。
// 収益化とは独立した「アクセス解析の開示」として作成（誠実性方針）。
// レイアウト・クラスは /about（detail-*）に合わせる。

import Link from "next/link";
import type { Metadata } from "next";
import { SITE, absoluteUrl } from "@/lib/site";

const PATH = "/privacy";
const TITLE = `プライバシーポリシー｜${SITE.name}`;
const DESC =
  "KurashiMapのプライバシーポリシー。Google アナリティクス（GA4）によるアクセス解析、Cookie の利用、収集する情報の範囲と利用目的、外部サイトへのリンクの扱いを開示しています。";

// 最終更新日（ポリシー改定時に手動更新）。
const LAST_UPDATED = "2026年7月21日";

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
  // ポリシーページは検索意図が薄く重複も生みやすいため、index はするが過度な露出は避ける。
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  const ldJson = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: SITE.name, item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: "プライバシーポリシー", item: absoluteUrl(PATH) },
        ],
      },
      {
        "@type": "WebPage",
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
        <span className="breadcrumb-current">プライバシーポリシー</span>
      </nav>

      <header className="detail-hero">
        <h1 className="detail-title">プライバシーポリシー</h1>
        <p className="detail-lead">
          {SITE.name}（以下「当サイト」）における、利用者の情報の取り扱い方針です。当サイトはアクセス状況の把握のために Google アナリティクスを利用しています。本ポリシーでは、収集する情報の範囲・目的・第三者への送信・利用者による無効化の方法を開示します。
        </p>
      </header>

      <section className="detail-section">
        <h2 className="detail-h2">当サイトが収集しない情報</h2>
        <p className="detail-p">
          当サイトは会員登録・ログイン・問い合わせフォーム・コメント欄などを設けておらず、氏名・住所・メールアドレス・電話番号といった<strong>個人を直接特定できる情報を収集・保存しません</strong>。利用にあたって個人情報の入力を求めることはありません。
        </p>
      </section>

      <section className="detail-section">
        <h2 className="detail-h2">アクセス解析（Google アナリティクス）について</h2>
        <p className="detail-p">
          当サイトは、サービスの改善のために Google LLC が提供するアクセス解析ツール「Google アナリティクス 4（GA4）」を利用しています。GA4 は Cookie を用いて、利用者の閲覧履歴に関する次のような情報を収集します。これらは統計的な分析のために利用され、個人を特定するものではありません。
        </p>
        <ul className="detail-p" style={{ paddingLeft: "1.2em" }}>
          <li>閲覧したページの URL・タイトル、滞在時間、参照元（どこから訪れたか）</li>
          <li>おおよその地域（IP アドレスを基に推定。GA4 では IP アドレスは保存されません）</li>
          <li>利用しているブラウザ・OS・デバイスの種類、画面サイズ、言語設定</li>
          <li>当サイト内での操作（例: 地図の指標切り替え、自治体の選択、外部リンクのクリック）</li>
        </ul>
        <p className="detail-p">
          これらのデータは Google 社のサーバーに送信・保管されます。Google 社におけるデータの取り扱いについては、
          <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google プライバシーポリシー</a>
          および
          <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer">Google のサービスを使用するサイトやアプリから収集した情報の取り扱い</a>
          をご確認ください。当サイトは、収集した解析データを広告のターゲティング等の目的で第三者に販売・提供することはありません。
        </p>
      </section>

      <section className="detail-section">
        <h2 className="detail-h2">Cookie の利用と無効化</h2>
        <p className="detail-p">
          Cookie は、ウェブサイトが利用者のブラウザに保存する小さなテキストデータです。当サイトでは上記のアクセス解析のために Cookie を利用します。Cookie には氏名等の個人情報は含まれません。
        </p>
        <p className="detail-p">
          利用者はブラウザの設定によって Cookie の受け入れを拒否・削除できます。また、Google アナリティクスによる計測を無効にしたい場合は、Google 社が提供する
          <a href="https://tools.google.com/dlpage/gaoptout?hl=ja" target="_blank" rel="noopener noreferrer">Google アナリティクス オプトアウト アドオン</a>
          を利用できます。Cookie を無効化しても、当サイトの閲覧そのものは通常どおり可能です。
        </p>
      </section>

      <section className="detail-section">
        <h2 className="detail-h2">外部サイトへのリンクについて</h2>
        <p className="detail-p">
          当サイトには、ふるさと納税ポータルや支援（寄付）サービスなど、外部の事業者が運営するサイトへのリンクを掲載する場合があります。リンク先を識別するために、遷移元が当サイトであることを示すパラメータ（UTM）を付与することがありますが、これに個人情報は含まれません。リンク先で収集される情報の取り扱いは各サイトのプライバシーポリシーに従います。当サイトはリンク先サイトの内容・サービスについて責任を負いません。
        </p>
      </section>

      <section className="detail-section">
        <h2 className="detail-h2">お問い合わせ・データの取り扱い</h2>
        <p className="detail-p">
          掲載データの誤りのご指摘など当サイトへのご連絡は、
          <Link href="/about">このサイトについて</Link>
          のページに記載の方針に沿ってお願いします。当サイトが扱う統計データの出典・更新方針についても同ページで公開しています。
        </p>
      </section>

      <section className="detail-section">
        <h2 className="detail-h2">本ポリシーの改定</h2>
        <p className="detail-p">
          当サイトは、法令の変更やサービス内容の変更に応じて、本ポリシーを予告なく改定することがあります。改定後の内容は本ページに掲載した時点から効力を生じます。
        </p>
        <p className="detail-p" style={{ fontSize: 13, color: "var(--text-muted)" }}>
          最終更新日: {LAST_UPDATED}
        </p>
      </section>

      <div style={{ marginTop: 28, display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Link href="/" className="detail-back">地図で見る</Link>
        <Link href="/about" className="detail-back">このサイトについて</Link>
      </div>
    </div>
  );
}
