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

import { useEffect, useRef, useState } from "react";
import { trackSelectSection } from "@/lib/analytics";

export type SectionNavItem = { id: string; label: string };

export default function SectionNav({
  items,
  municipalityCode,
}: {
  items: SectionNavItem[];
  municipalityCode: string;
}) {
  const [active, setActive] = useState(items[0]?.id ?? "");
  const navRef = useRef<HTMLElement>(null);
  // クリック直後は観測結果を一定時間無視する。スムーススクロール中は途中のセクションを
  // 通過して監視が何度も発火し、押した項目から表示が外れてしまうため。
  //
  // 「観測が自分の選択に追いつくまで据え置く」方式も試したが、着地後に境界を
  // またがないと発火しないので解除されず、現在地が固まったままになった。
  // 時間で切るほうは必ず失効するので、最悪でも表示が一瞬ズレるだけで済む。
  const pinnedUntil = useRef(0);

  useEffect(() => {
    // jsdom や古い環境では IntersectionObserver が無い。その場合はスクロールスパイを
    // 諦めるだけで、リンク自体は通常のアンカーとして動き続ける。
    if (typeof IntersectionObserver === "undefined") return;

    const els = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => el != null);
    if (els.length === 0) return;

    // ナビ帯の高さは CSS 側（.ad-secnav のパディングとチップの min-height）で決まり、
    // SP ではチップのパディングも変わる。定数で二重管理せず実測する。
    const navHeight = navRef.current?.offsetHeight ?? 0;

    // IO は「境界をまたいだ」ことを知るためだけに使い、現在地はその場で測り直す。
    // entry.boundingClientRect は使えない: IO は状態が変わった要素ぶんしか entry を
    // 配らないので、キャッシュすると発火しなかったセクションの値が古いまま残り、
    // 現在地を取り違える（実際にそうなった）。発火は境界をまたいだ時だけで、
    // 1回あたり要素数ぶんの測定なので、そのまま読んで問題ない。
    // ビューポート上端（ナビ帯の下）より上にある最後の要素が現在地。
    // 閾値の +9 は CSS の scroll-margin-top（ナビ高 + 8px スラック）に合わせる。
    // アンカー着地位置がちょうどナビ帯の 8px 下になるため、閾値がナビ高ぴったりだと
    // 飛んだ直後の要素自身が現在地として拾えない。
    const pick = () => {
      let current = els[0].id;
      for (const el of els) {
        if (el.getBoundingClientRect().top <= navHeight + 9) current = el.id;
      }
      if (Date.now() < pinnedUntil.current) return;
      setActive(current);
    };

    const io = new IntersectionObserver(pick, { rootMargin: `-${navHeight}px 0px 0px 0px` });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  return (
    <nav
      ref={navRef}
      className="ad-secnav"
      aria-label="このページの目次"
      // リンクごとにハンドラを作らず、nav 側で受けて押されたアンカーから id を読む。
      onClick={(e) => {
        const a = (e.target as HTMLElement).closest("a");
        if (!a) return;
        const id = a.hash.slice(1);
        setActive(id);
        pinnedUntil.current = Date.now() + 800;
        trackSelectSection(id, municipalityCode);
      }}
    >
      {items.map((item) => (
        <a key={item.id} href={`#${item.id}`} aria-current={item.id === active ? "true" : undefined}>
          {item.label}
        </a>
      ))}
    </nav>
  );
}
