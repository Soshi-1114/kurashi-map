"use client";

// トップのファーストビュー用・自治体検索コンボボックス。
// 行タップ（主動作）＝自治体詳細ページへ遷移（「調べる」意図のメインアクション。
// 駅行はその駅がある自治体の詳細ページへ）。
// 行右端の地図ピン（副動作）＝ページ内の地図へスクロールしてその自治体へフライト
//（「地図で周辺を見たい」意図。駅行は自治体 bbox ではなく駅座標へマーカー付きで飛ぶ）。
// ドロップダウンの見た目は既存の .search-results 系クラスを再利用する。
// コンボボックスの状態機械（絞り込み・キーボード操作）は useMuniCombobox を共有する。
// クエリが空でフォーカス中は、検索結果の代わりに「最近見た自治体」履歴を出す
// （useSearchHistory / useMuniCombobox の historyCodes 連携）。
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import type { MuniSummary } from "@/lib/types";
import { useMuniCombobox, type ComboboxHit } from "@/lib/useMuniCombobox";
import { comboboxHitSuffix } from "@/lib/muniLabel";
import { requestMapFly } from "@/lib/mapFly";
import { SearchHistoryHeader } from "@/components/SearchHistoryHeader";
import { SearchHitLabel } from "@/components/SearchHitLabel";

export default function HeroSearch({ munis }: { munis: MuniSummary[] }) {
  const router = useRouter();
  const onPick = useCallback((m: MuniSummary) => router.push(`/area/${m.pref}/${m.code}`), [router]);
  // townSearch: 町丁名（例: 日の里）やひらがな、stationSearch: 駅名（例: 品川駅）でも
  // 自治体を引けるようにする
  const { query, setQuery, filtered, isHistory, activeIndex, setActiveIndex, pick, close, recordHistory, clearHistory, onKeyDown, onFocus, onBlur, inputRef } =
    useMuniCombobox(munis, onPick, { townSearch: true, stationSearch: true, history: true });

  // 副動作: ページ内の地図へスクロールし、その自治体（駅行なら駅座標）へフライトさせる
  // （遷移しない）。確定扱いなので履歴にも記録する。閉じ方はフックの close() に委ねる。
  const showOnMap = useCallback(
    (m: ComboboxHit<MuniSummary>) => {
      close();
      recordHistory(m.code);
      document.querySelector(".home-map")?.scrollIntoView({ behavior: "smooth" });
      requestMapFly({ code: m.code, station: m.station });
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
          placeholder="自治体名・駅で検索"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          onBlur={onBlur}
          aria-label="自治体・駅を検索してデータページへ移動"
          role="combobox"
          aria-expanded={filtered.length > 0}
          aria-controls="home-search-listbox"
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 && filtered[activeIndex] ? `hopt-${activeIndex}` : undefined}
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
          {/* 駅行は自治体行とコードが重複しうるため、key/id とも行番号ベースで一意にする
              （リストはクエリごとに全行作り直され、並べ替え・部分更新はない） */}
          {filtered.map((m, i) => (
            <li key={i} role="presentation" className="search-row">
              <button
                id={`hopt-${i}`}
                role="option"
                aria-selected={i === activeIndex}
                tabIndex={-1}
                className={i === activeIndex ? "is-active" : undefined}
                onClick={() => pick(m)}
                onMouseEnter={() => setActiveIndex(i)}
              >
                <SearchHitLabel m={m} />
              </button>
              <button
                type="button"
                className="search-mapbtn"
                aria-label={`${m.station ? comboboxHitSuffix(m) : (m.displayName ?? m.name)}を地図で表示`}
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
