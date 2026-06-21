"use client";

// トップの器。PC ではマップ(100dvh ヒーロー)＋その下にリンク帯がスクロールで続く。
// SP ではページをスクロールさせず、マップは全画面のまま。ヘッダーのメニューから
// リンク帯をドロワーとして重ねて表示する（地図のパン操作と競合させない）。
//
// children（HomeLinks）はサーバー側で描画され DOM に常に存在する＝クロール可能。
// SP で閉じている間も display:none にはせず、画面外に退避させるだけにする。

import { useState } from "react";
import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import type { MuniSummary } from "@/lib/types";

// MapLibre GL は ~209KB（初期バンドル最大のチャンク）。地図はクライアント専用で
// SSR 不可のため、next/dynamic + ssr:false で初期描画クリティカルパスから切り離し、
// JS の解析・実行を遅延させる（モバイルの LCP / TBT を改善）。ロード中は MapView
// 内の初回オーバーレイと同じ見た目のプレースホルダを出す。
const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="map-loading" aria-hidden="true">
      <div className="map-loading-spinner" />
      <div className="map-loading-text">地図を読み込み中…</div>
    </div>
  ),
});

export default function HomeShell({
  summary,
  children,
}: {
  summary: MuniSummary[];
  children: ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className={`home-root ${navOpen ? "is-nav-open" : ""}`}>
      <div className="home-map">
        <MapView summary={summary} onMenuClick={() => setNavOpen(true)} />
      </div>

      <div
        className="home-nav-backdrop"
        onClick={() => setNavOpen(false)}
        aria-hidden="true"
      />

      <aside className="home-links" aria-label="エリア・ランキングから探す">
        <button
          type="button"
          className="home-nav-close"
          aria-label="メニューを閉じる"
          onClick={() => setNavOpen(false)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        {children}
      </aside>
    </div>
  );
}
