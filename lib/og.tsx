// OG画像の共有パーツ。既存の自治体OG（app/api/og/[code]）の意匠に揃え、
// トップ・県・ランキングの各OGルートで使い回す。すべて edge ランタイム互換の
// 純粋な JSX（Node API なし）。
//
// 注: next/og の組込フォントには U+33A1（㎡）が無いので、値整形側で m² に置換する。

import type { ReactNode } from "react";

export const OG_SIZE = { width: 1200, height: 630 };

/** ブランドバッジ＋フッタ＋グラデ背景の共通枠。中身を children に流し込む。 */
export function OgFrame({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 45%, #bfdbfe 100%)",
        display: "flex",
        flexDirection: "column",
        padding: "64px 72px",
        fontFamily: "sans-serif",
        color: "#0f172a",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "linear-gradient(135deg, #60a5fa, #2563eb 60%, #1e3a8a)",
            boxShadow: "inset 0 -2px 6px rgba(0,0,0,0.18), 0 4px 12px rgba(37,99,235,0.4)",
          }}
        />
        <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.01em" }}>KurashiMap</div>
      </div>

      {children}

      <div
        style={{
          position: "absolute",
          right: 72,
          top: 72,
          fontSize: 18,
          color: "#64748b",
          fontWeight: 600,
          background: "rgba(255,255,255,0.7)",
          padding: "6px 14px",
          borderRadius: 999,
          border: "1px solid rgba(15,23,42,0.08)",
        }}
      >
        kurashimap.jp
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
        background: accent ? "#1e3a8a" : "rgba(255,255,255,0.85)",
        color: accent ? "#ffffff" : "#0f172a",
        padding: "16px 24px",
        borderRadius: 16,
        border: accent ? "none" : "1px solid rgba(15,23,42,0.08)",
        boxShadow: accent ? "0 12px 30px rgba(30,58,138,0.35)" : "0 4px 12px rgba(15,23,42,0.08)",
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
        color: "#1e3a8a",
        background: "rgba(255,255,255,0.85)",
        border: "1px solid rgba(15,23,42,0.08)",
        padding: "10px 22px",
        borderRadius: 999,
        boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
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
        <div style={{ fontSize: 26, color: "#475569", fontWeight: 600 }}>{eyebrow}</div>
      )}
      <div
        style={{
          marginTop: 4,
          fontSize: titleSize,
          fontWeight: 900,
          letterSpacing: "-0.03em",
          lineHeight: 1.08,
          color: "#0f172a",
        }}
      >
        {title}
      </div>
      {sub && (
        <div style={{ marginTop: 12, fontSize: 30, color: "#1e3a8a", fontWeight: 600 }}>{sub}</div>
      )}
    </div>
  );
}
