"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Municipality } from "@/lib/types";
import { buildSummary } from "@/lib/summary";
import { MetricCards } from "./AreaPanel";

type Stage = "half" | "full";

type Props = {
  municipality: Municipality | null;
  onClose: () => void;
};

// half は persistent / 200px、full は modal / 82vh。+ iOS safe-area。
const STAGE_HEIGHTS: Record<Stage, string> = {
  half: "calc(200px + env(safe-area-inset-bottom))",
  full: "calc(82vh + env(safe-area-inset-bottom))",
};

const IS_MODAL: Record<Stage, boolean> = {
  half: false,
  full: true,
};

const DRAG_DISMISS_THRESHOLD = 110; // px ドラッグで half へ snap

export default function MobileSheet({ municipality, onClose }: Props) {
  const [stage, setStage] = useState<Stage>("half");
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartY = useRef<number | null>(null);

  // 自治体が切り替わったら half に戻す（読みかけリセット）
  useEffect(() => {
    setStage("half");
    setDragOffset(0);
  }, [municipality?.code]);

  if (!municipality) return null;
  const m = municipality;

  const toggle = () => setStage((s) => (s === "half" ? "full" : "half"));
  const collapse = () => setStage("half");

  // ドラッグ（full モード時のみ有効、下方向に縮める）
  const onTouchStart = (e: React.TouchEvent) => {
    if (stage !== "full") return;
    dragStartY.current = e.touches[0].clientY;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const dy = e.touches[0].clientY - dragStartY.current;
    setDragOffset(Math.max(0, dy)); // 下方向のみ
  };
  const onTouchEnd = () => {
    if (dragStartY.current === null) return;
    if (dragOffset > DRAG_DISMISS_THRESHOLD) {
      setStage("half");
    }
    setDragOffset(0);
    dragStartY.current = null;
  };

  const heading = m.displayName ?? m.name;
  const heightStyle =
    stage === "full" && dragOffset > 0
      ? `calc(${STAGE_HEIGHTS.full} - ${dragOffset}px)`
      : STAGE_HEIGHTS[stage];

  return (
    <>
      {IS_MODAL[stage] && (
        <div className="sheet-scrim" aria-hidden="true" onClick={collapse} />
      )}
      <div
        className={`sheet sheet-stage-${stage}${dragOffset > 0 ? " is-dragging" : ""}`}
        style={{ height: heightStyle }}
        role="dialog"
        aria-modal={IS_MODAL[stage]}
        aria-label={`${heading}の詳細`}
      >
        <button
          className="sheet-handle-btn"
          aria-label={stage === "full" ? "シートを縮める" : "シートを拡大"}
          onClick={toggle}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
        >
          <span className="sheet-handle" />
        </button>

        <div className="sheet-content">
          <div className="panel-head-top">
            <div style={{ minWidth: 0, flex: 1 }}>
              <h2 className="panel-title" style={{ fontSize: 17 }}>{heading}</h2>
              <p className="panel-sub" style={{ margin: "2px 0 0" }}>
                家賃 <strong style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{m.rent.value.toLocaleString()}</strong> 円/月
                <span className="trend-chip">{m.populationTrend}</span>
              </p>
            </div>
            <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
              {stage === "full" && (
                <button className="panel-close" aria-label="シートを縮める" onClick={collapse}>
                  <ChevronDown />
                </button>
              )}
              <button className="panel-close" aria-label="閉じる" onClick={onClose}>×</button>
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <MetricCards m={m} />
          </div>

          {stage === "full" && (
            <div style={{ marginTop: 16 }}>
              <div className="summary-block">{buildSummary(m)}</div>
              <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "8px 0" }}>
                人口 {m.population.toLocaleString()}人
              </p>
              {m.hazard.note && (
                <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "8px 0" }}>
                  災害メモ: {m.hazard.note}
                </p>
              )}
              <Link href={`/area/${m.pref}/${m.code}`} className="cta-button">
                詳細を見る →
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function ChevronDown() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
