"use client";

// トップのファーストビュー用・自治体検索コンボボックス。
// 地図ヘッダーの MuniSearch（確定で地図をフライトさせる）と違い、こちらは確定で
// 自治体詳細ページ /area/{pref}/{code} へ遷移する（「調べる」動線のメインアクション）。
// ドロップダウンの見た目は既存の .search-results 系クラスを再利用する。
// コンボボックスの状態機械（絞り込み・キーボード操作）は useMuniCombobox を共有する。
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import type { MuniSummary } from "@/lib/types";
import { useMuniCombobox } from "@/lib/useMuniCombobox";
import { muniContextLabel } from "@/lib/muniLabel";

export default function HeroSearch({ munis }: { munis: MuniSummary[] }) {
  const router = useRouter();
  const onPick = useCallback((m: MuniSummary) => router.push(`/area/${m.pref}/${m.code}`), [router]);
  const { query, setQuery, filtered, activeIndex, setActiveIndex, pick, onKeyDown } = useMuniCombobox(munis, onPick);

  return (
    <div className="home-search">
      <div className="home-search-wrap">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="search"
          placeholder="市区町村名を入力（例: 宗像市）"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label="自治体を検索してデータページへ移動"
          role="combobox"
          aria-expanded={filtered.length > 0}
          aria-controls="home-search-listbox"
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 && filtered[activeIndex] ? `hopt-${filtered[activeIndex].code}` : undefined
          }
        />
      </div>
      {filtered.length > 0 && (
        <ul id="home-search-listbox" className="search-results" role="listbox" aria-label="自治体の検索候補">
          {filtered.map((m, i) => (
            <li key={m.code} role="presentation">
              <button
                id={`hopt-${m.code}`}
                role="option"
                aria-selected={i === activeIndex}
                tabIndex={-1}
                className={i === activeIndex ? "is-active" : undefined}
                onClick={() => pick(m)}
                onMouseEnter={() => setActiveIndex(i)}
              >
                <span className="search-place">
                  {muniContextLabel(m) && <span className="search-pref">{muniContextLabel(m)}</span>}
                  <span className="search-name">{m.name}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
