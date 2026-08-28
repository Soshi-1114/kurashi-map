"use client";

// 検索コンボボックス候補行のラベル部（都道府県コンテキスト + 自治体名 +（町丁/駅））。
// ヘッダー検索（MuniSearch）とヒーロー検索（HeroSearch）が同一マークアップを共有する
// （SearchHistoryHeader と同じ趣旨の presentational 部品）。行の主動作（遷移/選択）や
// 付加列（家賃・地図ピン）は各呼び出し側が持ち、ここはラベル表示のみを担う。
import type { ComboboxHit, MuniSearchItem } from "@/lib/useMuniCombobox";
import { muniContextLabel, comboboxHitSuffix } from "@/lib/muniLabel";

export function SearchHitLabel({ m }: { m: ComboboxHit<MuniSearchItem> }) {
  const context = muniContextLabel(m);
  const suffix = comboboxHitSuffix(m);
  return (
    <span className="search-place">
      {context && <span className="search-pref">{context}</span>}
      <span className="search-name">{m.name}</span>
      {suffix && <span className="search-town">（{suffix}）</span>}
    </span>
  );
}
