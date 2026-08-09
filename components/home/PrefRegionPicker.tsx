"use client";

// トップの「都道府県から探す」を 地方 → 都道府県 の2段階にする。
// 47件を一度に並べると塊に見えて目的の県を探しづらいので、まず地方を選び、
// その地方の県だけを出す（最大8件）。
//
// 全地方のパネルは常に DOM にある（非選択は hidden 属性）。クライアント
// コンポーネントもサーバーで HTML に描画されるため、47県のリンクは初期HTMLに
// すべて含まれる＝クロール可能。
import { useId, useRef, useState } from "react";
import Link from "next/link";
import { prefsByRegion } from "@/lib/prefs";

// 初期選択の地方。空パネルを見せないため既定で1つ開いておく。
const INITIAL_REGION = "kanto";

export default function PrefRegionPicker() {
  const groups = prefsByRegion();
  const baseId = useId();
  const [active, setActive] = useState(() =>
    groups.some((g) => g.key === INITIAL_REGION) ? INITIAL_REGION : groups[0].key,
  );
  // ← → で移動したときにフォーカスも運ぶ（roving tabindex）
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const tabId = (key: string) => `${baseId}-tab-${key}`;
  const panelId = (key: string) => `${baseId}-panel-${key}`;

  // WAI-ARIA の tabs パターン: ← → Home End でタブを移動する
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const i = groups.findIndex((g) => g.key === active);
    let next: number;
    if (e.key === "ArrowRight") next = (i + 1) % groups.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + groups.length) % groups.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = groups.length - 1;
    else return;
    e.preventDefault();
    const key = groups[next].key;
    setActive(key);
    tabRefs.current[key]?.focus();
  };

  return (
    <div className="home-region">
      <div className="home-region-tabs" role="tablist" aria-label="地方" onKeyDown={onKeyDown}>
        {groups.map((g) => (
          <button
            key={g.key}
            ref={(el) => {
              tabRefs.current[g.key] = el;
            }}
            id={tabId(g.key)}
            type="button"
            role="tab"
            aria-selected={g.key === active}
            aria-controls={panelId(g.key)}
            tabIndex={g.key === active ? 0 : -1}
            className="home-region-tab"
            onClick={() => setActive(g.key)}
          >
            {g.nameJa}
          </button>
        ))}
      </div>

      {groups.map((g) => (
        <div
          key={g.key}
          id={panelId(g.key)}
          role="tabpanel"
          aria-labelledby={tabId(g.key)}
          hidden={g.key !== active}
          className="home-region-panel"
        >
          <ul className="home-pref-grid">
            {g.prefs.map((p) => (
              <li key={p.slug}>
                <Link href={`/area/${p.slug}`} className="home-pref-link">
                  {p.nameJa}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
