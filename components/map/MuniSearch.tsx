"use client";

// ヘッダーの自治体検索コンボボックス。確定時は onSelect に自治体を渡す
// （地図側は選択とフライトだけ担当）。状態機械は useMuniCombobox を共有し、
// 名前・ひらがな読み・町丁名（例: 日の里 → 宗像市（日の里））・駅名
// （例: 品川駅 → 港区（品川駅）。確定で駅位置へフライト）で検索できる。
// クエリが空でフォーカス中は、検索結果の代わりに「最近見た自治体」履歴を出す
// （useSearchHistory / useMuniCombobox の historyCodes 連携）。
import { useCallback, useMemo } from "react";
import type { MuniSummary } from "@/lib/types";
import { useMuniCombobox, type ComboboxHit } from "@/lib/useMuniCombobox";
import { muniContextLabel } from "@/lib/muniLabel";
import { hasRent } from "@/lib/rentColor";
import { SearchHistoryHeader } from "@/components/SearchHistoryHeader";

type Props = {
  municipalities: MuniSummary[];
  wards: MuniSummary[];
  onSelect: (m: ComboboxHit<MuniSummary>) => void | Promise<void>;
};

export default function MuniSearch({ municipalities, wards, onSelect }: Props) {
  // 市区町村と区を両方検索対象に
  const candidates = useMemo(() => [...municipalities, ...wards], [municipalities, wards]);
  const onPick = useCallback((m: ComboboxHit<MuniSummary>) => void onSelect(m), [onSelect]);
  const { query, setQuery, filtered, isHistory, activeIndex, setActiveIndex, pick, clearHistory, onKeyDown, onFocus, onBlur, inputRef } =
    useMuniCombobox(candidates, onPick, { townSearch: true, stationSearch: true, history: true });

  return (
    <div className="app-header-search">
      <div className="search-input-wrap">
        <SearchIcon />
        <input
          ref={inputRef}
          type="search"
          placeholder="自治体名・駅で検索"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          onBlur={onBlur}
          aria-label="自治体・駅の検索"
          role="combobox"
          aria-expanded={filtered.length > 0}
          aria-controls="muni-search-listbox"
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 && filtered[activeIndex] ? `sopt-${activeIndex}` : undefined}
        />
      </div>
      {filtered.length > 0 && (
        <ul
          id="muni-search-listbox"
          className="search-results"
          role="listbox"
          aria-label="自治体の検索候補"
          // 候補クリックの mousedown で input が blur してリストが閉じるのを防ぐ
          // （各ボタンに置かず、バブリングを利用して一括で受ける）
          onMouseDown={(e) => e.preventDefault()}
        >
          {isHistory && <SearchHistoryHeader onClear={clearHistory} />}
          {/* 駅行は自治体行とコードが重複しうるため、key/id とも行番号ベースで一意にする
              （リストはクエリごとに全行作り直され、並べ替え・部分更新はない） */}
          {filtered.map((m, i) => (
            <li key={i} role="presentation">
              <button
                id={`sopt-${i}`}
                role="option"
                aria-selected={i === activeIndex}
                tabIndex={-1}
                className={i === activeIndex ? "is-active" : undefined}
                onClick={() => pick(m)}
                onMouseEnter={() => setActiveIndex(i)}
              >
                <span className="search-place">
                  {muniContextLabel(m) && (
                    <span className="search-pref">{muniContextLabel(m)}</span>
                  )}
                  <span className="search-name">{m.name}</span>
                  {m.town && <span className="search-town">（{m.town}）</span>}
                  {m.station && <span className="search-town">（{m.station.name}駅）</span>}
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

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
