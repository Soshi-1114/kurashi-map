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
};

const STAGE_HEIGHTS: Record<Stage, string> = {
  min: "84px",
  half: "55vh",
  full: "92vh",
};

export default function MobileSheet({ municipality, onClose }: Props) {
  const [stage, setStage] = useState<Stage>("half");
  if (!municipality) return null;
  const m = municipality;

  const cycle = () => {
    setStage((s) => (s === "min" ? "half" : s === "half" ? "full" : "min"));
  };

  return (
    <div className="sheet" style={{ height: STAGE_HEIGHTS[stage] }}>
      <button className="sheet-handle-btn" aria-label="シート段階を切替" onClick={cycle}>
        <span className="sheet-handle" />
      </button>
      <div className="sheet-content">
        <div className="panel-head-top">
          <h2 className="panel-title" style={{ fontSize: 18 }}>{m.name}</h2>
          <button className="panel-close" aria-label="閉じる" onClick={onClose}>×</button>
        </div>
        <p className="panel-sub" style={{ marginBottom: 12 }}>
          家賃 {m.rent.value.toLocaleString()} {m.rent.unit}
          <span className="trend-chip">{m.populationTrend}</span>
        </p>

        {stage !== "min" && (
          <>
            <div className="summary-block">{buildSummary(m)}</div>
            <MetricCards m={m} />
          </>
        )}

        {stage === "full" && (
          <div style={{ marginTop: 14 }}>
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
