"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { compareHref, MAX_COMPARE, parseToolSource, type ToolSource } from "@/lib/siteNav";
import { normalizeCompareCandidates, type CompareCandidate } from "@/lib/compareSelection";
import { track } from "@/lib/analytics";

const STORAGE_KEY = "kurashimap.compare-candidates.v1";

function compareStartSource(pathname: string | null): ToolSource {
  if (!pathname || pathname === "/") return "home";
  if (pathname === "/map" || pathname.startsWith("/map/")) return "map";
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] === "area" && segments.length >= 3) return "area_detail";
  if (segments[0] === "area" && segments.length === 2) return "pref_hub";
  if (segments[0] === "ranking") {
    if (segments[2] === "prefecture") return "prefecture_ranking";
    if (segments.length >= 3) return "pref_ranking";
    return "ranking";
  }
  return "header";
}

type CompareSelection = {
  candidates: CompareCandidate[];
  ready: boolean;
  toggle: (candidate: CompareCandidate) => void;
  replace: (candidates: CompareCandidate[], source?: ToolSource) => void;
};

const Context = createContext<CompareSelection | null>(null);

export function CompareSelectionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [candidates, setCandidates] = useState<CompareCandidate[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      try {
        const saved = sessionStorage.getItem(STORAGE_KEY);
        if (saved && active) setCandidates(normalizeCompareCandidates(JSON.parse(saved)));
      } catch {
        // Storage may be disabled. The in-memory selection still works.
      }
      if (active) setReady(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(candidates));
    } catch {
      // Keep the selection for this page session if storage is unavailable.
    }
  }, [candidates, ready]);

  const replace = useCallback((next: CompareCandidate[], source?: ToolSource) => {
    const normalized = normalizeCompareCandidates(next);
    setCandidates((current) => JSON.stringify(current) === JSON.stringify(normalized) ? current : normalized);
    if (source) {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      } catch {
        // In-memory fallback.
      }
    }
  }, []);

  const toggle = useCallback((candidate: CompareCandidate) => {
    const exists = candidates.some((item) => item.code === candidate.code);
    if (exists) {
      track("compare_candidate_remove", { municipality_code: candidate.code, tool_source: candidate.source });
      setCandidates(candidates.filter((item) => item.code !== candidate.code));
      return;
    }
    if (candidates.length >= MAX_COMPARE) return;
    track("compare_candidate_add", { municipality_code: candidate.code, tool_source: candidate.source });
    setCandidates([...candidates, candidate]);
  }, [candidates]);

  const value = useMemo(() => ({ candidates, ready, toggle, replace }), [candidates, ready, toggle, replace]);
  const hideBar = pathname === "/compare" || pathname === "/map" || pathname?.startsWith("/map/");
  const startSource = compareStartSource(pathname);

  return (
    <Context.Provider value={value}>
      <div className="compare-selection-root" onClickCapture={(event) => {
        const target = event.target as HTMLElement;
        const link = target.closest<HTMLAnchorElement>("a[data-compare-add]");
        if (!link) return;
        const code = link.dataset.compareAdd;
        const name = link.dataset.compareName;
        const pref = link.dataset.comparePref;
        const source = parseToolSource(link.dataset.compareSource ?? null);
        if (!ready || !code || !name || !pref || !source) return;
        event.preventDefault();
        toggle({ code, name, pref, source });
      }}>
        {children}
        {ready && candidates.length > 0 && !hideBar && (
          <aside className="compare-selection-bar" aria-label="比較候補">
            <div className="compare-selection-inner">
              <div className="compare-selection-names" aria-live="polite">
                <strong>{candidates.length}件選択中</strong>
                <ul>
                  {candidates.map((item) => (
                    <li key={item.code}>
                      <span title={`${item.pref}${item.name}`}>{item.name}</span>
                      <button type="button" aria-label={`${item.name}を比較候補から外す`} onClick={() => toggle(item)}>×</button>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="compare-selection-actions">
                <button type="button" onClick={() => replace([])} aria-label="比較候補をすべて解除">すべて解除</button>
                <Link
                  href={compareHref(candidates.map((item) => item.code), startSource)}
                  onClick={() => track("compare_candidate_start", {
                    count: candidates.length,
                    municipality_codes: candidates.map((item) => item.code).join(","),
                    tool_source: startSource,
                  })}
                >
                  {candidates.length === 1 ? "もう1件選ぶ" : `${candidates.length}件を比較`}
                </Link>
              </div>
            </div>
          </aside>
        )}
      </div>
    </Context.Provider>
  );
}

export function useCompareSelection() {
  const value = useContext(Context);
  if (!value) throw new Error("useCompareSelection must be used within CompareSelectionProvider");
  return value;
}

export function CompareCandidateButton({
  code, name, pref, source,
}: { code: string; name: string; pref: string; source: ToolSource }) {
  const { candidates, ready, toggle } = useCompareSelection();
  const selected = candidates.some((item) => item.code === code);
  const full = candidates.length >= MAX_COMPARE;
  return (
    <button
      type="button"
      className="compare-candidate-toggle"
      aria-pressed={selected}
      disabled={!ready || (full && !selected)}
      onClick={() => toggle({ code, name, pref, source })}
    >
      {selected ? "比較候補から外す" : full ? "3件選択済み" : "比較に追加"}
    </button>
  );
}
