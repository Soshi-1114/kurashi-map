// OG画像の共有パーツ。トップ・自治体・県・ランキングの4ルートすべてがここを使う
// （意匠を1箇所に集約し、ルートごとに分岐させない）。純粋な JSX のみで Node API なし。
//
// 注: next/og の組込フォントには U+33A1（㎡）が無いので、値整形側で m² に置換する。

import type { ReactNode } from "react";
import { SITE } from "./site";

export const OG_SIZE = { width: 1200, height: 630 };

/** OG画像の配色。
 *
 *  Satori は CSS 変数を解決できないため、globals.css の :root をそのまま参照できない。
 *  そこで値を TS 側に写し、両者が一致していることを tests/lib/designTokens.test.ts で
 *  検証する（片方だけ変えるとテストが落ちる）。新しい色を足す時は必ず :root 側にも
 *  対応するトークンを用意し、テストのマッピングに追加すること。 */
export const OG = {
  primary: "#3a739e",       // --color-primary
  primaryHover: "#2e6a92",  // --color-primary-hover
  primaryBg: "#eaf4fb",     // --color-primary-bg
  primarySubtle: "#f3f8fc", // --color-primary-subtle
  surface: "#ffffff",       // --color-surface
  ink: "#1e293b",           // --color-ink
  inkMuted: "#64748b",      // --color-ink-muted
  line: "#e2e8f0",          // --color-line
} as const;

/** ImageResponse の共通オプション。
 *
 *  OG 画像は対象データが更新（四半期/年次）→再デプロイされた時のみ変わる。
 *  明示しないとリクエストごとに生成されうるため、4ルート共通で長めにキャッシュする
 *  （ブラウザ1日／CDN7日。再デプロイで CDN は自動パージされる）。 */
export const OG_RESPONSE = {
  ...OG_SIZE,
  headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800" },
};

/** フッタに出すサイトのホスト名（"kurashimap.jp"）。SITE.baseUrl から導出する。 */
const SITE_HOST = SITE.baseUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");

// ブランドロゴ（家ピン＋地図ベース）。satori はインライン SVG の clipPath/polygon を
// 完全には描けないため、resvg が完全対応する data URI 画像として渡す。
// ここの色はロゴそのものの配色であり、UI のブランドカラー（OG.primary）とは別系統。
// public/logo.svg の手動コピーなので、ロゴを差し替えた時は両方を更新すること。
const LOGO_SVG =
  `<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">` +
  `<defs><clipPath id="tile"><rect width="64" height="64" rx="15"/></clipPath></defs>` +
  `<rect width="64" height="64" rx="15" fill="#ffffff"/>` +
  `<g clip-path="url(#tile)">` +
  `<polygon points="0,47 20,42 30,53 6,64 0,64" fill="#94c97f"/>` +
  `<polygon points="6,64 30,53 41,61 30,64" fill="#ecd382"/>` +
  `<polygon points="20,42 39,39 47,50 30,53" fill="#c6e2a2"/>` +
  `<polygon points="39,39 64,43 64,57 47,50" fill="#93c2e4"/>` +
  `<polygon points="47,50 64,57 64,64 41,61" fill="#7fb1d9"/>` +
  `<path d="M-2 50L66 45" stroke="#ffffff" stroke-width="2.4" fill="none"/>` +
  `<path d="M26 40L34 64" stroke="#ffffff" stroke-width="2.4" fill="none"/>` +
  `<path d="M44 40L55 64" stroke="#ffffff" stroke-width="2" fill="none"/>` +
  `</g>` +
  `<path d="M32 5.5C21.2 5.5 12.5 14 12.5 24.5C12.5 38.5 32 53.5 32 53.5C32 53.5 51.5 38.5 51.5 24.5C51.5 14 42.8 5.5 32 5.5Z" fill="#1d5c7e"/>` +
  `<path d="M21.5 28L32 17.5L42.5 28Z" fill="#ffffff"/>` +
  `<rect x="24.5" y="26.5" width="15" height="12.5" rx="0.6" fill="#ffffff"/>` +
  `<rect x="27.6" y="29" width="8.8" height="8.8" fill="#1d5c7e"/>` +
  `<rect x="31.5" y="29" width="1" height="8.8" fill="#ffffff"/>` +
  `<rect x="27.6" y="32.9" width="8.8" height="1" fill="#ffffff"/>` +
  `</svg>`;
const LOGO_URI = `data:image/svg+xml;utf8,${encodeURIComponent(LOGO_SVG)}`;

/** ブランドバッジ＋フッタ＋グラデ背景の共通枠。中身を children に流し込む。 */
export function OgFrame({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: `linear-gradient(135deg, ${OG.primarySubtle} 0%, ${OG.primaryBg} 100%)`,
        display: "flex",
        flexDirection: "column",
        padding: "64px 72px",
        fontFamily: "sans-serif",
        color: OG.ink,
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_URI} width="46" height="46" alt="" />
        <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.01em" }}>{SITE.name}</div>
      </div>

      {children}

      <div
        style={{
          position: "absolute",
          right: 72,
          top: 72,
          fontSize: 18,
          color: OG.inkMuted,
          fontWeight: 600,
          background: OG.surface,
          padding: "6px 14px",
          borderRadius: 999,
          border: `1px solid ${OG.line}`,
        }}
      >
        {SITE_HOST}
      </div>
    </div>
  );
}

/** 強調つきの数値カード（自治体OGと同デザイン）。 */
export function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: accent ? OG.primary : OG.surface,
        color: accent ? "#fff" : OG.ink,
        padding: "16px 24px",
        borderRadius: 16,
        // サイト側の Card 規則（1px ボーダー・シャドウなし）に揃える
        border: `1px solid ${accent ? OG.primary : OG.line}`,
      }}
    >
      <span style={{ fontSize: 16, opacity: 0.8, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 36, fontWeight: 800, marginTop: 4, letterSpacing: "-0.01em" }}>
        {value}
      </span>
    </div>
  );
}

/** 丸いタグ（特徴の列挙用）。 */
export function Pill({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        fontSize: 24,
        fontWeight: 700,
        color: OG.primary,
        background: OG.surface,
        border: `1px solid ${OG.line}`,
        padding: "10px 22px",
        borderRadius: 999,
      }}
    >
      {children}
    </div>
  );
}

/** 見出しブロック（小さなアイブロウ＋大見出し＋サブ）。 */
export function OgHeading({
  eyebrow,
  title,
  sub,
  titleSize = 84,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
  titleSize?: number;
}) {
  return (
    <div style={{ marginTop: 52, display: "flex", flexDirection: "column" }}>
      {eyebrow && (
        <div style={{ fontSize: 26, color: OG.inkMuted, fontWeight: 600 }}>{eyebrow}</div>
      )}
      <div
        style={{
          marginTop: 4,
          fontSize: titleSize,
          fontWeight: 900,
          letterSpacing: "-0.03em",
          lineHeight: 1.08,
          color: OG.ink,
        }}
      >
        {title}
      </div>
      {sub && (
        <div style={{ marginTop: 12, fontSize: 30, color: OG.primary, fontWeight: 600 }}>{sub}</div>
      )}
    </div>
  );
}
