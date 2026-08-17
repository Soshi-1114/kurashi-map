"use client";

// 自治体検索の「最近見た自治体」履歴。localStorage には自治体コードのみを保存し
// （名称は表示側が候補配列から都度解決するので、合併等で名称が変わってもズレない）、
// 新しい順・重複除去・最大 MAX_HISTORY 件で保持する。
// localStorage が使えない環境（プライベートモード等）は握りつぶし、履歴なしで動作継続する。
import { useCallback, useState } from "react";

const STORAGE_KEY = "kurashimap:search-history";
const MAX_HISTORY = 8;

function readHistory(): string[] {
  // SSR では localStorage が無い。lazy initializer はハイドレーション時にも走るが、
  // 履歴は focus 中のみ描画に使うため（マウント直後は常に非focus）、SSR([])との
  // 差分がハイドレーション不整合を起こすことはない。
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === "string") : [];
  } catch {
    return [];
  }
}

export function useSearchHistory() {
  const [codes, setCodes] = useState<string[]>(readHistory);

  const record = useCallback((code: string) => {
    setCodes((prev) => {
      const next = [code, ...prev.filter((c) => c !== code)].slice(0, MAX_HISTORY);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // 保存に失敗しても履歴表示は今回の操作分だけメモリ上に残る
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setCodes([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // no-op
    }
  }, []);

  return { codes, record, clear };
}
