"use client";

// トップのファーストビュー用・自治体検索コンボボックス。
// 地図ヘッダーの MuniSearch（確定で地図をフライトさせる）と違い、こちらは確定で
// 自治体詳細ページ /area/{pref}/{code} へ遷移する（「調べる」動線のメインアクション）。
// ドロップダウンの見た目は既存の .search-results 系クラスを再利用する。
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { MuniSummary } from "@/lib/types";
import { getPrefByCode } from "@/lib/prefs";

export default function HeroSearch({ munis }: { munis: MuniSummary[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return munis
      .filter((m) => (m.displayName ?? m.name).includes(q) || m.name.includes(q))
      .slice(0, 8);
  }, [query, munis]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [query]);

  const pick = useCallback(
    (m: MuniSummary) => {
      setQuery("");
      router.push(`/area/${m.pref}/${m.code}`);
    },
    [router],
  );

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

  return (
    <div className="home-search">
      <div className="home-search-wrap">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="search"
          placeholder="市区町村名を入力（例: 宗像市）"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
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
        <ul id="home-search-listbox" className="search-results" role="listbox" aria-label="自治体の検索候補">
          {filtered.map((m, i) => (
            <li key={m.code} role="presentation">
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
                  {contextLabel(m) && <span className="search-pref">{contextLabel(m)}</span>}
                  <span className="search-name">{m.name}</span>
                </span>
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
function contextLabel(m: MuniSummary): string {
  const prefName = getPrefByCode(m.code)?.nameJa ?? "";
  if (m.level === "ward" && m.displayName) {
    const city = m.displayName.replace(m.name, "").trim();
    if (city) return `${prefName} ${city}`.trim();
  }
  return prefName;
}
