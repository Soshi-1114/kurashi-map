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
// チップ（only:"sp"）を出し分ける。表示の切替もどちらが表示中かの判定も CSS
// （area-detail.css の .ad-nav-pc / .ad-nav-sp）だけが持ち、JS は描画結果
// （offsetParent）から可視チップを読む——ブレークポイントを二重管理しない。
export type SectionNavItem = { id: string; label: string; only?: "pc" | "sp" };

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

    const nav = navRef.current;
    // 同じ id が pc/sp 両方のチップに現れうるので、要素は id 単位で1つに集約する
    const els = [...new Set(items.map((i) => i.id))]
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el != null);
    if (!nav || els.length === 0) return;

    // 現在地の判定線。setup() がナビ下の可視領域の上から1/3に引き直す。
    let line = 0;

    // IO は「境界をまたいだ」ことを知るためだけに使い、現在地はその場で測り直す。
    // entry.boundingClientRect は使えない: IO は状態が変わった要素ぶんしか entry を
    // 配らないので、キャッシュすると発火しなかったセクションの値が古いまま残り、
    // 現在地を取り違える（実際にそうなった）。発火は境界をまたいだ時だけで、
    // 1回あたり要素数ぶんの測定なので、そのまま読んで問題ない。
    // 判定線より上にある最後の「表示中チップの」要素が現在地。非表示チップの id
    // （PC での kids/foreign 等）まで含めると、同一位置の要素同士で後者が勝って
    // しまい、表示中のチップが光らない。可視性は描画結果（display:none の <a> は
    // offsetParent が null）から読み、ブレークポイントは CSS だけに持たせる。
    const pick = () => {
      const visibleIds = new Set(
        Array.from(nav.querySelectorAll<HTMLAnchorElement>("a"))
          .filter((a) => a.offsetParent !== null)
          .map((a) => a.hash.slice(1)),
      );
      const visibleEls = els.filter((el) => visibleIds.has(el.id));
      if (visibleEls.length === 0) return;
      let current = visibleEls[0].id;
      for (const el of visibleEls) {
        if (el.getBoundingClientRect().top <= line + 1) current = el.id;
      }
      if (Date.now() < pinnedUntil.current) return;
      setActive(current);
    };

    // 判定線と観測帯を（作り直しも含めて）張る。
    // - 判定線はナビ帯直下ではなく、ナビ下の可視領域の上から1/3。ナビ直下だと、
    //   次のセクションが画面の大半を占めても先頭がほぼ最上端を通過するまで前の
    //   チップが点いたままで、縦に大きいカード・セクションで「遅い」と感じる。
    //   アンカー着地位置（ナビ高+8px の scroll-margin-top）より必ず深いので、
    //   チップクリック直後の飛び先も確実に自分が現在地になる。
    // - 観測ボックスは判定線上の細い帯（1px）。上側だけ絞る指定だと、要素の
    //   「上端が判定線を跨ぐ」瞬間は要素全体がまだ交差したままで発火せず、
    //   他要素の出入り待ちで更新が遅れる。帯なら上端・下端が跨ぐたびに必ず発火する。
    // - ナビ高は CSS 依存（SP でパディングが変わる）なので定数にせず実測する。
    let io: IntersectionObserver | null = null;
    const setup = () => {
      io?.disconnect();
      const navHeight = nav.offsetHeight;
      line = navHeight + Math.round((window.innerHeight - navHeight) / 3);
      const bandBottom = Math.max(0, window.innerHeight - line - 1);
      io = new IntersectionObserver(pick, { rootMargin: `-${line}px 0px -${bandBottom}px 0px` });
      // observe は初回観測を必ず配信するので、setup 直後に pick が非同期で走る
      els.forEach((el) => io!.observe(el));
    };
    setup();

    // 判定線・帯はビューポート高依存。リサイズ（回転含む）で張り直さないと、
    // 縮んだ画面では帯が画面外に出て一切発火しなくなり、現在地が固まる。
    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(setup, 200);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
      io?.disconnect();
    };
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
    // behavior は指定しない: 滑らかさは CSS の scroll-behavior（.ad-secnav、
    // reduced-motion 連動）に委ねる（html の scroll-behavior と同じ既存パターン）。
    nav.scrollTo({ left: link.offsetLeft - (nav.clientWidth - link.offsetWidth) / 2 });
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
