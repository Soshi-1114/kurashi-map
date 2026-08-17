"use client";

// トップのファーストビュー用・自治体検索コンボボックス。
// 行タップ（主動作）＝自治体詳細ページへ遷移（「調べる」意図のメインアクション）。
// 行右端の地図ピン（副動作）＝ページ内の地図へスクロールしてその自治体へフライト
//（「地図で周辺を見たい」意図。検索バーを2本に戻さずに両方の意図を満たす）。
// ドロップダウンの見た目は既存の .search-results 系クラスを再利用する。
// コンボボックスの状態機械（絞り込み・キーボード操作）は useMuniCombobox を共有する。
// クエリが空でフォーカス中は、検索結果の代わりに「最近見た自治体」履歴を出す
// （useSearchHistory / useMuniCombobox の historyCodes 連携）。
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import type { MuniSummary } from "@/lib/types";
import { useMuniCombobox } from "@/lib/useMuniCombobox";
import { muniContextLabel } from "@/lib/muniLabel";
import { requestMapFly } from "@/lib/mapFly";
import { SearchHistoryHeader } from "@/components/SearchHistoryHeader";

export default function HeroSearch({ munis }: { munis: MuniSummary[] }) {
  const router = useRouter();
  const onPick = useCallback((m: MuniSummary) => router.push(`/area/${m.pref}/${m.code}`), [router]);
  // townSearch: 町丁名（例: 日の里）やひらがなでも自治体を引けるようにする
  const { query, setQuery, filtered, isHistory, activeIndex, setActiveIndex, pick, close, recordHistory, clearHistory, onKeyDown, onFocus, onBlur, inputRef } =
    useMuniCombobox(munis, onPick, { townSearch: true, history: true });

  // 副動作: ページ内の地図へスクロールし、その自治体へフライトさせる（遷移しない）。
  // 確定扱いなので履歴にも記録する。閉じ方はフックの close() に委ねる。
  const showOnMap = useCallback(
    (m: MuniSummary) => {
      close();
      recordHistory(m.code);
      document.querySelector(".home-map")?.scrollIntoView({ behavior: "smooth" });
      requestMapFly(m.code);
    },
    [close, recordHistory],
  );

  return (
    <div className="home-search">
      <div className="home-search-wrap">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          placeholder="市区町村名を入力（例: 新宿区）"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          onBlur={onBlur}
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
        <ul
          id="home-search-listbox"
          className="search-results"
          role="listbox"
          aria-label="自治体の検索候補"
          // 候補クリックの mousedown で input が blur してリストが閉じるのを防ぐ
          // （各ボタンに置かず、バブリングを利用して一括で受ける）
          onMouseDown={(e) => e.preventDefault()}
        >
          {isHistory && <SearchHistoryHeader onClear={clearHistory} />}
          {/* filtered は自治体コード単位に集約済み（同じ自治体が名前ヒットと町丁ヒットの
              両方で重複することはない）ので、key/id はコードのみで一意 */}
          {filtered.map((m, i) => (
            <li key={m.code} role="presentation" className="search-row">
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
                  {m.town && <span className="search-town">（{m.town}）</span>}
                </span>
              </button>
              <button
                type="button"
                className="search-mapbtn"
                aria-label={`${m.displayName ?? m.name}を地図で表示`}
                title="地図で表示"
                onClick={() => showOnMap(m)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
