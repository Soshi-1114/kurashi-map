"use client";

// 自治体詳細ページの目次（ヒーロー直下に貼り付く sticky なチップ列）。
//
// 見た目はモックのタブバーだが、実体は素のアンカーリンクで「タブ」ではない。
// コンテンツは1つも隠さず、クリックで該当セクションへスクロールするだけ。
// 詳細ページは PC で約5,900px・SP で約9,000px あり、
// 「どこに何があるか」を示して回遊できるようにするのが目的。
// この設計を選んだ経緯（真のタブにしない理由）は docs/area-page-navigation.md を参照。
//
// - role="tablist" は使わない。タブではないので支援技術に誤った期待を与えない。
//   現在地は aria-current="true" で示す。
// - JS が動かなくても素の <a href="#..."> として機能する（SSR された HTML に載る）。
// - IntersectionObserver は「現在地の見た目」だけに使い、
//   コンテンツの表示可否には一切関与しない（Reveal.tsx の経緯コメント参照）。

import { useCallback, useEffect, useRef, useState } from "react";
import { trackSelectSection } from "@/lib/analytics";

export type SectionNavItem = { id: string; label: string };

/** アンカー先がナビ帯の下に潜らないためのオフセット。CSS の --ad-secnav-h と揃える。 */
const NAV_OFFSET = 61;

export default function SectionNav({
  items,
  municipalityCode,
}: {
  items: SectionNavItem[];
  municipalityCode: string;
}) {
  const [active, setActive] = useState(items[0]?.id ?? "");
  // クリック直後は IO の発火を待たずに現在地を確定させる（体感の遅れを消す）。
  // スムーススクロール中は途中のセクションを通過して IO が何度も発火するため、
  // 短時間だけ IO の結果を無視する。
  const pinnedUntil = useRef(0);

  useEffect(() => {
    // jsdom や古い環境では IntersectionObserver が無い。その場合はスクロールスパイを
    // 諦めるだけで、リンク自体は通常のアンカーとして動き続ける。
    if (typeof IntersectionObserver === "undefined") return;

    const els = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => el != null);
    if (els.length === 0) return;

    // IO は交差境界をまたいだ時だけ発火する。そのタイミングで
    // 「ビューポート上端（ナビ帯の下）より上にある最後の要素」を現在地にする。
    // 交差率で決めるよりスクロールの体感と一致し、スクロールごとの再計算も要らない。
    const pick = () => {
      if (Date.now() < pinnedUntil.current) return;
      let current = els[0].id;
      for (const el of els) {
        if (el.getBoundingClientRect().top <= NAV_OFFSET + 1) current = el.id;
      }
      setActive(current);
    };

    const io = new IntersectionObserver(pick, {
      rootMargin: `-${NAV_OFFSET}px 0px 0px 0px`,
      threshold: [0, 1],
    });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items]);

  const onSelect = useCallback(
    (id: string) => {
      setActive(id);
      pinnedUntil.current = Date.now() + 800; // スムーススクロールが終わるまで
      trackSelectSection(id, municipalityCode);
    },
    [municipalityCode],
  );

  if (items.length === 0) return null;

  return (
    <nav className="ad-secnav" aria-label="このページの目次">
      {items.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          aria-current={item.id === active ? "true" : undefined}
          onClick={() => onSelect(item.id)}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
