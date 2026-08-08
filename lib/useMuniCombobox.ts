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
import { useCallback, useEffect, useMemo, useState } from "react";
import type { MuniSummary } from "./types";
import { toHiragana } from "./kana";
import { TOWN_QUERY_MIN } from "./townSearch";

/** 候補1行。town があれば「町丁名でヒットした自治体」行（例 宗像市（日の里））。 */
export type ComboboxHit<T extends MuniSummary> = T & { town?: string };

type TownApiHit = { code: string; town: string };

// 入力中の連打を抑えるデバウンス（/api/town-search を呼ぶ最小クエリ長は townSearch.ts の
// TOWN_QUERY_MIN をサーバー側と共有する）
const TOWN_DEBOUNCE_MS = 150;

export function useMuniCombobox<T extends MuniSummary>(
  candidates: T[],
  onPick: (m: T) => void,
  opts?: { limit?: number; townSearch?: boolean },
) {
  const limit = opts?.limit ?? 8;
  const townSearch = opts?.townSearch ?? false;
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [townHits, setTownHits] = useState<TownApiHit[]>([]);

  const q = query.trim();

  // 名前＋かな読みでのローカル絞り込み（即時）
  const muniHits = useMemo(() => {
    if (!q) return [];
    const hq = toHiragana(q);
    return candidates
      .filter((m) => (m.displayName ?? m.name).includes(q) || m.name.includes(q) || (!!m.kana && m.kana.includes(hq)))
      .slice(0, limit);
  }, [q, candidates, limit]);

  // 町丁名での自治体検索（デバウンス付きの API 呼び出し）。クエリが変わるたびに
  // 前回のタイマー・リクエストを破棄するので、反映されるのは常に最新クエリの結果のみ。
  useEffect(() => {
    if (!townSearch || q.length < TOWN_QUERY_MIN) {
      setTownHits((prev) => (prev.length ? [] : prev));
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/town-search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (!res.ok) return;
        const json = (await res.json()) as { towns?: TownApiHit[] };
        setTownHits(Array.isArray(json.towns) ? json.towns : []);
      } catch {
        // 中断・オフライン時は町丁候補なしで自治体候補のみ表示
      }
    }, TOWN_DEBOUNCE_MS);
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [q, townSearch]);

  const byCode = useMemo(() => new Map(candidates.map((m) => [m.code, m])), [candidates]);

  // 自治体名ヒットを先頭に、残り枠へ町丁ヒットを「自治体名（町丁名）」行として追加。
  // 同じ自治体は1行まで（名前ヒット済みの自治体を町丁で重複表示しない）。
  const filtered = useMemo<ComboboxHit<T>[]>(() => {
    if (!q) return [];
    const out: ComboboxHit<T>[] = [...muniHits];
    if (out.length < limit && townHits.length > 0) {
      const seen = new Set(out.map((m) => m.code));
      for (const t of townHits) {
        if (out.length >= limit) break;
        if (seen.has(t.code)) continue;
        const m = byCode.get(t.code);
        if (!m) continue;
        seen.add(t.code);
        out.push({ ...m, town: t.town });
      }
    }
    return out;
  }, [q, muniHits, townHits, byCode, limit]);

  // クエリが変わったらキーボード選択位置をリセット
  useEffect(() => {
    setActiveIndex(-1);
  }, [query]);

  const pick = useCallback(
    (m: T) => {
      setQuery("");
      onPick(m);
    },
    [onPick],
  );

  // コンボボックスのキーボード操作（↓↑で候補移動・Enterで確定・Escで閉じる）
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        setQuery("");
        return;
      }
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
    },
    [filtered, activeIndex, pick],
  );

  return { query, setQuery, filtered, activeIndex, setActiveIndex, pick, onKeyDown };
}
