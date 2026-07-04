"use client";

// ヘッダーの自治体検索コンボボックス。検索クエリ・候補・キーボード選択位置の
// 状態はこのコンポーネントが持ち、確定時は onSelect に自治体を渡して自らクエリを
// クリアする（地図側は選択とフライトだけ担当）。
import { useCallback, useEffect, useMemo, useState } from "react";
import type { MuniSummary } from "@/lib/types";
import { getPrefByCode } from "@/lib/prefs";
import { hasRent } from "@/lib/rentColor";

type Props = {
  municipalities: MuniSummary[];
  wards: MuniSummary[];
  onSelect: (m: MuniSummary) => void | Promise<void>;
};

export default function MuniSearch({ municipalities, wards, onSelect }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  // 検索候補のキーボード選択位置（-1 = 未選択）。コンボボックスの aria-activedescendant に対応。
  const [activeIndex, setActiveIndex] = useState(-1);

  const filtered = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return [];
    // 市区町村と区を両方検索対象に
    return [...municipalities, ...wards]
      .filter((m) => (m.displayName ?? m.name).includes(q) || m.name.includes(q))
      .slice(0, 8);
  }, [searchQuery, municipalities, wards]);

  // 候補リストが変わるたびにキーボード選択位置をリセット
  useEffect(() => { setActiveIndex(-1); }, [searchQuery]);

  const pick = useCallback((m: MuniSummary) => {
    setSearchQuery("");
    void onSelect(m);
  }, [onSelect]);

  // コンボボックスのキーボード操作（↓↑で候補移動・Enterで確定・Escで閉じる）
  const onSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") { setSearchQuery(""); return; }
    if (!filtered.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? filtered.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && activeIndex < filtered.length) {
        e.preventDefault();
        pick(filtered[activeIndex]);
      }
    }
  }, [filtered, activeIndex, pick]);

  return (
    <div className="app-header-search">
      <div className="search-input-wrap">
        <SearchIcon />
        <input
          type="search"
          placeholder="自治体名で検索"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={onSearchKeyDown}
          aria-label="自治体検索"
          role="combobox"
          aria-expanded={filtered.length > 0}
          aria-controls="muni-search-listbox"
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 && filtered[activeIndex] ? `sopt-${filtered[activeIndex].code}` : undefined}
        />
      </div>
      {filtered.length > 0 && (
        <ul id="muni-search-listbox" className="search-results" role="listbox" aria-label="自治体の検索候補">
          {filtered.map((m, i) => (
            <li key={m.code} role="presentation">
              <button
                id={`sopt-${m.code}`}
                role="option"
                aria-selected={i === activeIndex}
                tabIndex={-1}
                className={i === activeIndex ? "is-active" : undefined}
                onClick={() => pick(m)}
                onMouseEnter={() => setActiveIndex(i)}
              >
                <span className="search-place">
                  {searchContextLabel(m) && (
                    <span className="search-pref">{searchContextLabel(m)}</span>
                  )}
                  <span className="search-name">{m.name}</span>
                </span>
                <span className="search-rent">{hasRent(m.rent) ? `${m.rent.toLocaleString()}円` : "—"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// 検索候補に添える所属コンテキスト（都道府県名。政令市の区は「県名 市名」）。
// 同名自治体（府中市=東京/広島、北区=東京/大阪市/さいたま市…）の誤選択を防ぐ。
function searchContextLabel(m: MuniSummary): string {
  const prefName = getPrefByCode(m.code)?.nameJa ?? "";
  if (m.level === "ward" && m.displayName) {
    const city = m.displayName.replace(m.name, "").trim();
    if (city) return `${prefName} ${city}`.trim();
  }
  return prefName;
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
