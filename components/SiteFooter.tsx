import Link from "next/link";
import { GENERAL_MAP, MAP_HUBS, type NavLink } from "@/lib/siteNav";

// 全ページ共通フッター（サーバーコンポーネント＝リンクは初期HTMLに載る）。
// 内部リンクグラフの底上げが目的。設置は PageShell が担い、PageShell を使わない
// ページ（トップの home-main 手書き系）では各ページが main の後ろに自分で置く。
// 全画面地図の /map/* はレイアウト上フッターを持てないため対象外。
// 全ページに載るリンク集なので prefetch は無効（viewport prefetch でハブ群を
// 毎ページ先読みさせない）。
const COLUMNS: Array<{ heading: string; links: readonly NavLink[] }> = [
  { heading: "地図で見る", links: [GENERAL_MAP, ...MAP_HUBS] },
  {
    heading: "調べる・比べる",
    links: [
      { href: "/ranking", label: "住みやすさランキング" },
      { href: "/compare", label: "自治体を比較" },
      { href: "/shindan", label: "住む街診断" },
      { href: "/denki", label: "電気代シミュレーション" },
    ],
  },
  {
    heading: "サイト情報",
    links: [
      { href: "/about", label: "このサイトについて（データの出典と更新方針）" },
      { href: "/privacy", label: "プライバシーポリシー" },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <nav className="site-footer-nav" aria-label="サイト全体のリンク">
          {COLUMNS.map(({ heading, links }) => (
            <div key={heading} className="site-footer-col">
              <p className="site-footer-h">{heading}</p>
              <ul>
                {links.map(({ href, label }) => (
                  <li key={href}>
                    <Link href={href} prefetch={false}>{label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <p className="site-footer-copy">© KurashiMap — 政府統計の実データのみを収録しています（推計値は使いません）</p>
      </div>
    </footer>
  );
}
