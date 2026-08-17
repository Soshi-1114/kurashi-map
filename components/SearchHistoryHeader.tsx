"use client";

// 検索コンボボックスの「最近見た自治体」見出し行。ヘッダー検索（MuniSearch）・
// トップのヒーロー検索（HeroSearch）が同一マークアップを共有する
// （lib/useMuniCombobox.ts の isHistory と対）。mousedown の preventDefault は
// 親の <ul className="search-results"> が一括で行う。
import { History, X } from "lucide-react";

export function SearchHistoryHeader({ onClear }: { onClear: () => void }) {
  return (
    <li className="search-history-head" role="presentation">
      <span>
        <History size={13} aria-hidden="true" /> 最近見た自治体
      </span>
      <button type="button" className="search-history-clear" onClick={onClear}>
        <X size={12} aria-hidden="true" /> クリア
      </button>
    </li>
  );
}
