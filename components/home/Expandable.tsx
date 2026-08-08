"use client";

// モバイルで長くなりがちなリンク帯を「一部表示＋すべて表示」に畳む小さなラッパー。
// children はサーバー側で描画されたまま常に DOM に存在する（display は変えず
// max-height でクランプするだけ）ので、SEO 上重要なリンクはクライアント操作なしで
// HTML に含まれる。クランプは CSS のモバイルメディアクエリ内でのみ効き、PC では
// ボタンごと非表示＝常時全件表示になる。
import { useState } from "react";

export default function Expandable({
  children,
  moreLabel = "すべて表示",
  lessLabel = "閉じる",
}: {
  children: React.ReactNode;
  moreLabel?: string;
  lessLabel?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`home-collapse ${expanded ? "is-expanded" : ""}`}>
      <div className="home-collapse-body">{children}</div>
      <button
        type="button"
        className="home-collapse-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? lessLabel : moreLabel}
      </button>
    </div>
  );
}
