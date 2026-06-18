"use client";

import { useState } from "react";
import Link from "next/link";
import type { Municipality } from "@/lib/types";
import { buildSummary } from "@/lib/summary";
import { MetricCards } from "./AreaPanel";

type Stage = "min" | "half" | "full";

type Props = {
  municipality: Municipality | null;
  onClose: () => void;
  onStageChange?: (stage: Stage) => void;
};

const STAGE_HEIGHTS: Record<Stage, string> = {
  min: "92px",
  half: "340px",
  full: "82vh",
};

export default function MobileSheet({ municipality, onClose, onStageChange }: Props) {
  const [stage, setStage] = useState<Stage>("half");
  if (!municipality) return null;
  const m = municipality;

  const cycle = () => {
    setStage((s) => {
      const next: Stage = s === "min" ? "half" : s === "half" ? "full" : "min";
      onStageChange?.(next);
      return next;
    });
  };

  return (
    <div className="sheet" style={{ height: STAGE_HEIGHTS[stage] }}>
      <button className="sheet-handle-btn" aria-label="シート段階を切替" onClick={cycle}>
        <span className="sheet-handle" />
      </button>
      <div className="sheet-content">
        <div className="panel-head-top">
          <div>
            <h2 className="panel-title" style={{ fontSize: 17 }}>{m.name}</h2>
            <p className="panel-sub" style={{ margin: "2px 0 0" }}>
              家賃 <strong style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{m.rent.value.toLocaleString()}</strong> 円/月
              <span className="trend-chip">{m.populationTrend}</span>
            </p>
          </div>
          <button className="panel-close" aria-label="閉じる" onClick={onClose}>×</button>
        </div>

        {stage !== "min" && (
          <div style={{ marginTop: 12 }}>
            <MetricCards m={m} />
          </div>
        )}

        {stage === "full" && (
          <div style={{ marginTop: 14 }}>
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
  );
}
