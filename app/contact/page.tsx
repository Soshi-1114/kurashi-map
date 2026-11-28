import type { Metadata } from "next";
import Link from "@/components/SiteLink";
import PageShell from "@/components/PageShell";
import { SITE, absoluteUrl } from "@/lib/site";

const PATH = "/contact";
const TITLE = `お問い合わせ｜${SITE.name}`;
const DESC = `${SITE.name}へのお問い合わせフォームです。掲載データの誤りやサイトへのご要望をお送りいただけます。`;
const FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLScXbKnRIDvo3e2tCdVs31LwbJsn6TcuoLDA58jdOIoRQZ4j2g/viewform?embedded=true";
const FORM_RESPONDER_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLScXbKnRIDvo3e2tCdVs31LwbJsn6TcuoLDA58jdOIoRQZ4j2g/viewform";

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

export default function ContactPage() {
  return (
    <PageShell width="narrow" trail={[{ name: SITE.name, href: "/" }, { name: "お問い合わせ" }]}>
      <header className="detail-hero">
        <h1 className="detail-title">お問い合わせ</h1>
        <p className="detail-lead">
          掲載データの誤りのご指摘や、サイトへのご要望はこちらからお送りください。
        </p>
      </header>

      <section className="detail-section" aria-label="お問い合わせフォーム">
        <iframe
          title="KurashiMap お問い合わせフォーム"
          src={FORM_URL}
          width="100%"
          height="1120"
          loading="lazy"
          style={{ border: 0 }}
        />
        <p className="detail-p detail-p-muted">
          フォームが表示されない場合は、
          <a href={FORM_RESPONDER_URL} target="_blank" rel="noopener noreferrer">
            Googleフォームを別の画面で開く
          </a>
          をご利用ください。送信される情報の取り扱いは
          <Link href="/privacy">プライバシーポリシー</Link>
          をご確認ください。
        </p>
      </section>
    </PageShell>
  );
}
