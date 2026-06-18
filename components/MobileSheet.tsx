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

export default function MobileSheet({ municipality, onClose }: Props) {
  const [stage, setStage] = useState<Stage>("half");
  if (!municipality) return null;
  const m = municipality;

  const heightByStage: Record<Stage, string> = {
    min: "80px",
    half: "55vh",
    full: "92vh",
  };

  const cycle = () => {
    setStage((s) => (s === "min" ? "half" : s === "half" ? "full" : "min"));
  };

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: heightByStage[stage],
        background: "#ffffff",
        boxShadow: "0 -2px 12px rgba(0,0,0,0.12)",
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        zIndex: 10,
        transition: "height 220ms ease",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <button
        aria-label="シートの段階を切替"
        onClick={cycle}
        style={{
          padding: 6,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <span style={{ width: 40, height: 4, background: "#ccc", borderRadius: 2 }} />
      </button>
      <div style={{ padding: "0 16px 16px", overflowY: "auto", flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>{m.name}</h2>
          <button
            aria-label="閉じる"
            onClick={onClose}
            style={{ border: "none", background: "transparent", fontSize: 22, color: "#666", cursor: "pointer" }}
          >
            ×
          </button>
        </div>
        <p style={{ margin: "4px 0 12px", color: "#555", fontSize: 13 }}>
          家賃中央値 {m.rent.value.toLocaleString()} {m.rent.unit}
        </p>

        {stage !== "min" && (
          <>
            <p style={{ fontSize: 13, color: "#333", marginBottom: 12 }}>{buildSummary(m)}</p>
            <MetricCards m={m} />
          </>
        )}

        {stage === "full" && (
          <div style={{ marginTop: 14 }}>
            <p style={{ fontSize: 13, color: "#555" }}>
              人口 {m.population.toLocaleString()}人（{m.populationTrend}）
            </p>
            {m.hazard.note && (
              <p style={{ fontSize: 13, color: "#555" }}>災害メモ: {m.hazard.note}</p>
            )}
            <Link
              href={`/area/${m.pref}/${m.code}`}
              style={{
                display: "inline-block",
                marginTop: 8,
                padding: "10px 16px",
                background: "#1f4d7a",
                color: "white",
                borderRadius: 4,
                fontSize: 14,
              }}
            >
              詳細を見る
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
