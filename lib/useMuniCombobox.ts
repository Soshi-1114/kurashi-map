"use client";

// 自治体検索コンボボックスの共通状態機械（クエリ・候補絞り込み・キーボード選択）。
// 確定時の挙動（地図をフライトさせる／ページ遷移する／比較リストに追加する）は
// 呼び出し側が onPick で決める。候補の絞り込み元リスト（candidates）も呼び出し側が
// 用意する（比較ページは選択済みコードを除外した配列を渡す、等）。
import { useCallback, useEffect, useMemo, useState } from "react";
import type { MuniSummary } from "./types";

export function useMuniCombobox<T extends MuniSummary>(candidates: T[], onPick: (m: T) => void, limit = 8) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return candidates.filter((m) => (m.displayName ?? m.name).includes(q) || m.name.includes(q)).slice(0, limit);
  }, [query, candidates, limit]);

  // 候補リストが変わるたびにキーボード選択位置をリセット
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
