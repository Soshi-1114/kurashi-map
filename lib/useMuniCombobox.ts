"use client";

// 自治体検索コンボボックスの共通状態機械（クエリ・候補絞り込み・キーボード選択）。
// 確定時の挙動（地図をフライトさせる／ページ遷移する／比較リストに追加する）は
// 呼び出し側が onPick で決める。候補の絞り込み元リスト（candidates）も呼び出し側が
// 用意する（比較ページは選択済みコードを除外した配列を渡す、等）。
//
// 絞り込みは ①名前・表示名の部分一致 ②ひらがな読み（MuniSummary.kana）の部分一致
// （クエリはカタカナ→ひらがな正規化するので「ムナカタ」でも可）。
// townSearch を有効にすると、さらに /api/town-search で町丁名（大字）からも自治体を
// 引き、候補の後ろに「自治体名（町丁名）」行として追加する（例: 日の里 → 宗像市（日の里））。
//
// history を有効にすると、選択した自治体を localStorage 履歴（useSearchHistory）へ
// 記録し、クエリが空 かつ 入力にフォーカス中は検索結果の代わりに履歴を候補として
// 返す（isHistory=true）。フォーカス管理もこのフックが持つ（onFocus/onBlur を
// input に、inputRef を ref に渡す）。
//
// close()（選択確定 pick でも呼ぶ）は常に inputRef.current?.blur() で実DOMのfocusも
// 外す。コンボボックスが選択で閉じるのは一般的な挙動として妥当だが、これが必須に
// なる理由がもう1つある: 候補クリックの mousedown を preventDefault しているため、
// 実DOMのfocusはクリックだけでは外れない。blur しないと次にこの input をクリック
// しても focus イベントが発火せず、`focused` state が false のまま固まる
// （履歴＝クエリが空でフォーカス中の一覧なので、これを怠ると選択直後に同じ履歴が
// 再表示されてチラつく）。
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MuniSummary } from "./types";
import { toHiragana } from "./kana";
import { TOWN_QUERY_MIN } from "./townSearch";
import { STATION_QUERY_MIN, type StationHit } from "./stationSearch";
import { useSearchHistory } from "./useSearchHistory";

/**
 * 候補1行。town があれば「町丁名でヒットした自治体」行（例 宗像市（日の里））、
 * station があれば「駅名でヒットした自治体」行（例 港区（品川駅）。確定側は
 * station.lng/lat で駅位置へフライトできる）。
 */
export type ComboboxHit<T extends MuniSummary> = T & {
  town?: string;
  station?: { name: string; lng: number; lat: number };
};

type TownApiHit = { code: string; town: string };

// 入力中の連打を抑えるデバウンス（最小クエリ長は townSearch.ts / stationSearch.ts の
// TOWN_QUERY_MIN / STATION_QUERY_MIN をサーバー側と共有する）
const SUGGEST_DEBOUNCE_MS = 150;

// デバウンス付きサジェスト取得（町丁・駅で共用）。クエリが変わるたびに前回の
// タイマー・リクエストを破棄するので、反映されるのは常に最新クエリの結果のみ。
// より新しいクエリに差し替わっての中断（ctrl.abort）は無視し（次のリクエストが
// 状態を更新する）、サーバーエラー・オフライン等の実際の失敗時のみ候補なしに戻す
// （古いクエリの候補を残さない）。
function useDebouncedSuggest<T>(active: boolean, q: string, url: string, pluck: (json: unknown) => T[] | undefined): T[] {
  const [hits, setHits] = useState<T[]>([]);
  useEffect(() => {
    const clearHits = () => setHits((prev) => (prev.length ? [] : prev));
    if (!active) {
      clearHits();
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${url}?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (!res.ok) {
          clearHits();
          return;
        }
        const list = pluck((await res.json()) as unknown);
        setHits(Array.isArray(list) ? list : []);
      } catch {
        if (!ctrl.signal.aborted) clearHits();
      }
    }, SUGGEST_DEBOUNCE_MS);
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
    // pluck はレスポンスキーを選ぶだけの定数関数（呼び出し側でインライン定義）のため依存に含めない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, q, url]);
  return hits;
}

export function useMuniCombobox<T extends MuniSummary>(
  candidates: T[],
  onPick: (m: T) => void,
  opts?: { limit?: number; townSearch?: boolean; stationSearch?: boolean; history?: boolean },
) {
  const limit = opts?.limit ?? 8;
  const townSearch = opts?.townSearch ?? false;
  const stationSearch = opts?.stationSearch ?? false;
  const history = opts?.history ?? false;
  // フックの呼び出し規則上、常に呼ぶ（history 無効の呼び出し側では未使用のまま）
  const { codes: historyCodes, record: recordHistory, clear: clearHistory } = useSearchHistory();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const q = query.trim();

  // 名前＋かな読みでのローカル絞り込み（即時）
  const muniHits = useMemo(() => {
    if (!q) return [];
    const hq = toHiragana(q);
    return candidates
      .filter((m) => (m.displayName ?? m.name).includes(q) || m.name.includes(q) || (!!m.kana && m.kana.includes(hq)))
      .slice(0, limit);
  }, [q, candidates, limit]);

  // 自治体名ヒットが limit を埋めた場合、町丁・駅の候補は filtered で捨てられるため
  // 最初から取得しない（確実に無駄になる往復の抑止。表示結果は変わらない）。
  const muniFull = muniHits.length >= limit;
  const townHits = useDebouncedSuggest<TownApiHit>(
    townSearch && !muniFull && q.length >= TOWN_QUERY_MIN, q, "/api/town-search",
    (json) => (json as { towns?: TownApiHit[] }).towns,
  );
  const stationHits = useDebouncedSuggest<StationHit>(
    stationSearch && !muniFull && q.length >= STATION_QUERY_MIN, q, "/api/station-search",
    (json) => (json as { stations?: StationHit[] }).stations,
  );

  const byCode = useMemo(() => new Map(candidates.map((m) => [m.code, m])), [candidates]);

  // 自治体名ヒットを先頭に、残り枠へ駅ヒット（自治体名（〇〇駅）行）→町丁ヒット
  // （自治体名（町丁名）行）の順で追加。駅は自治体と別の実体なので、名前ヒット済みの
  // 自治体と重複しても行を出す（例:「品川」→ 品川区・港区（品川駅）の両方）。
  // 町丁は従来どおり同じ自治体を重複表示しない（駅で使った自治体も除く）。
  const filtered = useMemo<ComboboxHit<T>[]>(() => {
    if (!q) return [];
    const out: ComboboxHit<T>[] = [...muniHits];
    for (const s of stationHits) {
      if (out.length >= limit) break;
      const m = byCode.get(s.code);
      if (!m) continue;
      out.push({ ...m, station: { name: s.name, lng: s.lng, lat: s.lat } });
    }
    const seen = new Set(out.map((m) => m.code));
    for (const t of townHits) {
      if (out.length >= limit) break;
      if (seen.has(t.code)) continue;
      const m = byCode.get(t.code);
      if (!m) continue;
      seen.add(t.code);
      out.push({ ...m, town: t.town });
    }
    return out;
  }, [q, muniHits, stationHits, townHits, byCode, limit]);

  // 履歴候補（クエリ空・フォーカス中のみ使う）。コード配列から候補配列を都度解決するので、
  // 表示名の陳腐化がない。
  const historyHits = useMemo<ComboboxHit<T>[]>(() => {
    if (!history || historyCodes.length === 0) return [];
    const out: ComboboxHit<T>[] = [];
    for (const code of historyCodes) {
      const m = byCode.get(code);
      if (m) out.push(m);
    }
    return out.slice(0, limit);
  }, [history, historyCodes, byCode, limit]);

  const isHistory = !q && focused && historyHits.length > 0;
  const options = isHistory ? historyHits : filtered;

  // クエリが変わったらキーボード選択位置をリセット
  useEffect(() => {
    setActiveIndex(-1);
  }, [query, isHistory]);

  // コンボボックスを閉じる（クエリ消去＋focus解除）。確定以外の操作（HeroSearch の
  // 「地図で表示」等）からも呼べるよう単体で公開する。setFocused(false) は blur
  // イベントでも起きるが、未フォーカス状態で呼ばれた場合に備えて明示しておく。
  const close = useCallback(() => {
    setQuery("");
    setFocused(false);
    inputRef.current?.blur();
  }, []);

  const pick = useCallback(
    (m: T) => {
      close();
      if (history) recordHistory(m.code);
      onPick(m);
    },
    [close, history, recordHistory, onPick],
  );

  // コンボボックスのキーボード操作（↓↑で候補移動・Enterで確定・Escで閉じる）
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        setQuery("");
        return;
      }
      if (!options.length) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % options.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i <= 0 ? options.length - 1 : i - 1));
      } else if (e.key === "Enter") {
        if (activeIndex >= 0 && activeIndex < options.length) {
          e.preventDefault();
          pick(options[activeIndex]);
        }
      }
    },
    [options, activeIndex, pick],
  );

  const onFocus = useCallback(() => setFocused(true), []);
  const onBlur = useCallback(() => setFocused(false), []);

  return {
    query,
    setQuery,
    filtered: options,
    isHistory,
    activeIndex,
    setActiveIndex,
    pick,
    close,
    recordHistory,
    clearHistory,
    onKeyDown,
    onFocus,
    onBlur,
    inputRef,
  };
}
