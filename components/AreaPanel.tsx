"use client";

import Link from "next/link";
import type { Municipality } from "@/lib/types";
import { buildSummary } from "@/lib/summary";

type Props = {
  municipality: Municipality | null;
  onClose: () => void;
};

export default function AreaPanel({ municipality, onClose }: Props) {
  if (!municipality) return null;
  const m = municipality;
  return (
    <aside
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        width: 360,
        background: "#ffffff",
        boxShadow: "-2px 0 8px rgba(0,0,0,0.08)",
        overflowY: "auto",
        padding: 20,
        zIndex: 10,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>{m.name}</h2>
        <button
          aria-label="閉じる"
          onClick={onClose}
          style={{ border: "none", background: "transparent", fontSize: 22, cursor: "pointer", color: "#666" }}
        >
          ×
        </button>
      </div>
      <p style={{ color: "#555", margin: "8px 0 16px" }}>
        人口 {m.population.toLocaleString()}人（{m.populationTrend}）
      </p>
      <p style={{ fontSize: 14, color: "#333", marginBottom: 16 }}>{buildSummary(m)}</p>
      <MetricCards m={m} />
      <Link
        href={`/area/${m.pref}/${m.code}`}
        style={{
          display: "inline-block",
          marginTop: 16,
          padding: "10px 16px",
          background: "#1f4d7a",
          color: "white",
          borderRadius: 4,
          fontSize: 14,
        }}
      >
        詳細を見る
      </Link>
    </aside>
  );
}

export function MetricCards({ m }: { m: Municipality }) {
  const cards = [
    {
      label: "家賃中央値",
      value: `${m.rent.value.toLocaleString()} ${m.rent.unit}`,
      source: m.rent.source,
      asOf: m.rent.asOf,
      est: m.rent.isEstimated,
    },
    {
      label: "地価",
      value: `${m.landPrice.value.toLocaleString()} ${m.landPrice.unit}`,
      source: m.landPrice.source,
      asOf: m.landPrice.asOf,
      est: m.landPrice.isEstimated,
    },
    {
      label: "待機児童",
      value: `${m.waitlistChildren.value} ${m.waitlistChildren.unit}`,
      source: m.waitlistChildren.source,
      asOf: m.waitlistChildren.asOf,
      est: m.waitlistChildren.isEstimated,
    },
    {
      label: "災害リスク",
      value: m.hazard.hasFloodRisk ? "浸水想定あり" : "なし",
      source: m.hazard.source,
      asOf: m.hazard.asOf,
      est: false,
    },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      {cards.map((c) => (
        <div
          key={c.label}
          style={{
            border: "1px solid #e5e9ee",
            borderRadius: 6,
            padding: "10px 12px",
            background: "#fafbfc",
          }}
        >
          <div style={{ fontSize: 12, color: "#666" }}>{c.label}</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>
            {c.value}
            {c.est && <span style={{ marginLeft: 6, fontSize: 11, color: "#a07000" }}>※推計</span>}
          </div>
          <div style={{ fontSize: 10, color: "#999", marginTop: 4 }}>
            {c.source}（{c.asOf}）
          </div>
        </div>
      ))}
    </div>
  );
}
