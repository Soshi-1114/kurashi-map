"use client";

import Link from "next/link";
import { track } from "@/lib/analytics";
import { compareHref, MAX_COMPARE } from "@/lib/siteNav";
import { useCompareSelection } from "@/components/compare/CompareSelectionProvider";

export default function MapCompareControls({ compact = false }: { compact?: boolean }) {
  const { candidates, ready, toggle } = useCompareSelection();
  if (!ready || candidates.length === 0) return null;
  return (
    <div className={`map-compare-controls${compact ? " is-compact" : ""}`} aria-label="比較候補">
      <strong aria-live="polite">比較候補 {candidates.length}件</strong>
      {!compact && (
        <ul>
          {candidates.map((item) => (
            <li key={item.code}>
              <span>{item.name}</span>
              <button type="button" aria-label={`${item.name}を比較候補から外す`} onClick={() => toggle(item)}>×</button>
            </li>
          ))}
        </ul>
      )}
      <Link
        href={compareHref(candidates.map((item) => item.code), "map")}
        onClick={() => track("compare_candidate_start", {
          count: candidates.length,
          municipality_codes: candidates.map((item) => item.code).join(","),
          tool_source: "map",
        })}
      >
        {candidates.length === 1 ? "もう1件選ぶ" : `${candidates.length}件を比較`}
      </Link>
      {candidates.length >= MAX_COMPARE && !compact && <p>比較は3件までです。候補を外して追加してください。</p>}
    </div>
  );
}
