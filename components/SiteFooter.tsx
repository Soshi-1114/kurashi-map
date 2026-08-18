import Link from "next/link";

// 全ページ共通フッター（サーバーコンポーネント＝リンクは初期HTMLに載る）。
// 目的は内部リンクグラフの底上げ: /map/* ピラーと /denki への導線が従来
// トップ1箇所・自治体詳細最下部1本しかなく、半孤立していた。
// 全画面地図の /map/* 自体はレイアウト上フッターを持てないため対象外
//（PageShell を使うページとトップに表示する）。
// prefetch は無効: 全ページに載るリンク集なので、viewport prefetch で
// ハブ群を毎ページ先読みさせない。
const COLUMNS: Array<{ heading: string; links: Array<[href: string, label: string]> }> = [
  {
    heading: "地図で見る",
    links: [
      ["/map/rent", "家賃相場マップ"],
      ["/map/land-price", "地価マップ"],
      ["/map/population-trend", "人口増減マップ"],
      ["/map/future-population", "将来人口マップ（2050年推計）"],
      ["/map/foreign-ratio", "外国人住民の割合マップ"],
    ],
  },
  {
    heading: "調べる・比べる",
    links: [
      ["/ranking", "住みやすさランキング"],
      ["/compare", "自治体を比較"],
      ["/denki", "電気代シミュレーション"],
    ],
  },
  {
    heading: "サイト情報",
    links: [
      ["/about", "このサイトについて（データの出典と更新方針）"],
      ["/privacy", "プライバシーポリシー"],
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
                {links.map(([href, label]) => (
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
