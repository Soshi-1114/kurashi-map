"use client";

// 全画面地図ページ（汎用 /map・指標別 /map/*）の器。PC/SPとも地図を全画面で保ち、
// ヘッダーのメニューから説明とリンク帯をドロワーとして重ねて表示する
// （地図のパン操作と競合させない）。
//
// children（HomeLinks）はサーバー側で描画され DOM に常に存在する＝クロール可能。
// SP で閉じている間も display:none にはせず、画面外に退避させるだけにする。

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { ComponentProps, ReactNode } from "react";
import MapView from "@/components/MapView";
import type { MuniSummary } from "@/lib/types";
import type { MapMetricKey } from "@/lib/mapMetrics";

export default function HomeShell({
  summary,
  children,
  initialMetric,
  initialOverlays,
  menuLabel,
  navLabel = "エリア・ランキングから探す",
}: {
  summary: MuniSummary[];
  children: ReactNode;
  /** 地図の初期コロプレス指標（ピラーページで "foreignRatio" を指定）。既定は未塗り。 */
  initialMetric?: MapMetricKey | "none";
  /** 初期表示で点灯するオーバーレイ（ハザードのピラーページで指定）。 */
  initialOverlays?: ComponentProps<typeof MapView>["initialOverlays"];
  navLabel?: string;
  menuLabel?: string;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  const navPanel = useRef<HTMLElement>(null);
  const navContent = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const restoreFrame = useRef<number | null>(null);
  const menuId = useId();

  function openNav(opener: HTMLElement) {
    if (restoreFrame.current !== null) cancelAnimationFrame(restoreFrame.current);
    restoreFrame.current = null;
    returnFocus.current = opener;
    if (navContent.current) navContent.current.scrollTop = 0;
    setNavOpen(true);
  }

  const closeNav = useCallback(() => {
    if (restoreFrame.current !== null) cancelAnimationFrame(restoreFrame.current);
    setNavOpen(false);
    const opener = returnFocus.current;
    restoreFrame.current = requestAnimationFrame(() => {
      restoreFrame.current = null;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    });
  }, []);

  useEffect(() => () => {
    if (restoreFrame.current !== null) cancelAnimationFrame(restoreFrame.current);
  }, []);

  useEffect(() => {
    if (!navOpen) return;
    closeButton.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeNav();
        return;
      }
      if (event.key !== "Tab") return;
      const focusables = Array.from(navPanel.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [])
        .filter((element) => element.tabIndex >= 0 && !element.closest("[hidden], [inert]"));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [navOpen, closeNav]);

  return (
    <div className={`home-root ${navOpen ? "is-nav-open" : ""}`}>
      <div className="home-map" inert={navOpen}>
        <MapView summary={summary} onMenuClick={openNav} menuLabel={menuLabel} menuOpen={navOpen} menuId={menuId} initialMetric={initialMetric} initialOverlays={initialOverlays} />
      </div>

      <div
        className="home-nav-backdrop"
        onClick={closeNav}
        aria-hidden="true"
      />

      <aside ref={navPanel} id={menuId} className="home-links" aria-label={navLabel} inert={!navOpen} role="dialog" aria-modal={navOpen}>
        <div className="home-nav-toolbar">
          <button
            ref={closeButton}
            type="button"
            className="home-nav-close"
            aria-label="メニューを閉じる"
            onClick={closeNav}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div ref={navContent} className="home-nav-content">{children}</div>
      </aside>
    </div>
  );
}
