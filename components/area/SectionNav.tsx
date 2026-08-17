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

// only: ブレークポイント限定チップ。PC の2列グリッドでは同じ行のカード同士が
// 同一スクロール位置になり、カード単位のチップだと「閾値より上の最後の要素」を
// 取るスクロールスパイが常に右列だけを現在地にしてしまう（左列のチップは一度も
// 光らない）。そのため PC は行単位のまとめチップ（only:"pc"）、SP はカード単位の
// チップ（only:"sp"）を出し分ける。表示の切替は CSS（area-detail.css の
// .ad-nav-pc / .ad-nav-sp）、現在地判定は pick() が表示中の id だけで行う。
export type SectionNavItem = { id: string; label: string; only?: "pc" | "sp" };

// SP 判定は area-detail.css のグリッド切替（max-width: 640px で1列）と揃える
const SP_QUERY = "(max-width: 640px)";

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

    // 同じ id が pc/sp 両方のチップに現れうるので、要素は id 単位で1つに集約する
    const els = [...new Set(items.map((i) => i.id))]
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el != null);
    if (els.length === 0) return;

    // ナビ帯の高さは CSS 側（.ad-secnav のパディングとチップの min-height）で決まり、
    // SP ではチップのパディングも変わる。定数で二重管理せず実測する。
    const navHeight = navRef.current?.offsetHeight ?? 0;

    // 現在地の判定線はナビ帯直下ではなく、ナビ下の可視領域の上から1/3に置く。
    // 判定線がナビ直下だと、次のセクションが画面の大半を占めていても先頭がほぼ
    // 画面最上端を通過するまで前のチップが点いたままになり、縦に大きいカード・
    // セクション（災害リスク〜ランキング）で「ハイライトが遅い」と感じる。
    // アンカー着地位置（ナビ高+8px の scroll-margin-top）より必ず深い線なので、
    // チップクリック直後の飛び先も確実に自分が現在地になる。
    const line = navHeight + Math.round((window.innerHeight - navHeight) / 3);

    // IO は「境界をまたいだ」ことを知るためだけに使い、現在地はその場で測り直す。
    // entry.boundingClientRect は使えない: IO は状態が変わった要素ぶんしか entry を
    // 配らないので、キャッシュすると発火しなかったセクションの値が古いまま残り、
    // 現在地を取り違える（実際にそうなった）。発火は境界をまたいだ時だけで、
    // 1回あたり要素数ぶんの測定なので、そのまま読んで問題ない。
    // 判定線より上にある最後の「表示中チップの」要素が現在地。非表示チップの id
    // （PC での kids/foreign 等）まで含めると、同一位置の要素同士で後者が勝って
    // しまい、表示中のチップが光らない。
    const pick = () => {
      const sp = typeof window.matchMedia === "function" && window.matchMedia(SP_QUERY).matches;
      const visible = new Set(items.filter((i) => !i.only || i.only === (sp ? "sp" : "pc")).map((i) => i.id));
      let current = "";
      for (const el of els) {
        if (!visible.has(el.id)) continue;
        if (!current || el.getBoundingClientRect().top <= line + 1) current = el.id;
      }
      if (!current || Date.now() < pinnedUntil.current) return;
      setActive(current);
    };

    // 観測ボックスは判定線上の細い帯（1px）に絞る。上側だけ絞る指定だと、要素の
    // 「上端が判定線を跨ぐ」瞬間は要素全体がまだボックスと交差したままで発火せず、
    // 他の要素の出入り待ちになって更新が遅れる。帯にすれば各要素の上端・下端が
    // 判定線を跨ぐたびに交差が切り替わり、必要な瞬間に必ず発火する。
    const bandBottom = Math.max(0, window.innerHeight - line - 1);
    const io = new IntersectionObserver(pick, { rootMargin: `-${line}px 0px -${bandBottom}px 0px` });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items]);

  // チップ列が横スクロールしている時（主に SP）、現在地チップが見切れないよう
  // 中央へ追従させる。チップが全部収まっていれば scrollWidth 超過がなく何もしない。
  // scrollIntoView は使わない（ブラウザによってページ側の縦スクロールまで動かすため、
  // ナビ内の scrollLeft だけを操作する）。
  useEffect(() => {
    const nav = navRef.current;
    if (!nav || nav.scrollWidth <= nav.clientWidth) return;
    // 同じ id のチップが pc/sp 両方に存在しうるので、表示中(display:none でない)の方を選ぶ
    const link = Array.from(nav.querySelectorAll<HTMLAnchorElement>('a[aria-current="true"]')).find(
      (a) => a.offsetParent !== null,
    );
    if (!link) return;
    const left = link.offsetLeft - (nav.clientWidth - link.offsetWidth) / 2;
    const reduce =
      typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    nav.scrollTo({ left, behavior: reduce ? "auto" : "smooth" });
  }, [active]);

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
        <a
          key={`${item.id}:${item.only ?? "all"}`}
          href={`#${item.id}`}
          className={item.only === "pc" ? "ad-nav-pc" : item.only === "sp" ? "ad-nav-sp" : undefined}
          aria-current={item.id === active ? "true" : undefined}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
