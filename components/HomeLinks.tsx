// トップに置くクロール可能な内部リンク帯（サーバーコンポーネント＝初期HTMLに出力）。
// トップページでは地図下のコンテンツとして通常フローに表示する（メインコピーは
// ファーストビューのヒーロー側が持つため、ここには置かない）。

import Link from "next/link";
import { RANKINGS } from "@/lib/rankings";
import PrefRegionLinks from "@/components/PrefRegionLinks";

export type PopularMuni = { pref: string; code: string; name: string };

export default function HomeLinks({ popular }: { popular: PopularMuni[] }) {
  return (
    <div className="home-links-inner">
      <section className="home-links-block">
        <h2 className="home-links-h">KurashiMapでできること</h2>
        <dl className="home-cando">
          <div className="home-cando-item">
            <dt>自治体を知る</dt>
            <dd>人口・家賃・地価・子育て・医療・災害リスクの公的データから、地域の特徴を確認できます。</dd>
          </div>
          <div className="home-cando-item">
            <dt>自治体を比べる</dt>
            <dd>
              <Link href="/compare">比較ページ</Link>やランキング・地図の色分けで、複数の自治体のデータを並べて違いを確認できます。
            </dd>
          </div>
          <div className="home-cando-item">
            <dt>暮らしを考える</dt>
            <dd>全国平均・県平均・順位との比較から、その地域の位置づけを把握できます。</dd>
          </div>
        </dl>
      </section>

      <section className="home-links-block">
        <h2 className="home-links-h">都道府県から探す</h2>
        <PrefRegionLinks
          href={(slug) => `/area/${slug}`}
          linkClassName="home-pref-link"
          gridClassName="home-pref-grid"
        />
      </section>

      <section className="home-links-block">
        <h2 className="home-links-h">地図で見る</h2>
        <ul className="home-chip-row">
          <li><Link href="/map/rent" className="home-chip">家賃相場マップ</Link></li>
          <li><Link href="/map/land-price" className="home-chip">地価マップ</Link></li>
          <li><Link href="/map/population-trend" className="home-chip">人口増減マップ</Link></li>
          <li><Link href="/map/foreign-ratio" className="home-chip">外国人住民の割合マップ</Link></li>
        </ul>
      </section>

      <section className="home-links-block">
        <h2 className="home-links-h">ランキングで比較</h2>
        <ul className="home-chip-row">
          {RANKINGS.map((r) => (
            <li key={r.slug}>
              <Link href={`/ranking/${r.slug}`} className="home-chip">{r.title}</Link>
            </li>
          ))}
        </ul>
      </section>

      {popular.length > 0 && (
        <section className="home-links-block">
          <h2 className="home-links-h">人気の自治体</h2>
          <ul className="home-chip-row">
            {popular.map((m) => (
              <li key={m.code}>
                <Link href={`/area/${m.pref}/${m.code}`} className="home-chip">{m.name}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="home-links-foot">
        © KurashiMap — 出典: e-Stat（住宅・土地統計調査／国勢調査）・地価公示／地価調査・不動産情報ライブラリ・こども家庭庁・出入国在留管理庁 在留外国人統計（e-Stat）
        ／ <Link href="/about">このサイトについて（データの出典と更新方針）</Link>
        ／ <Link href="/privacy">プライバシーポリシー</Link>
      </p>
    </div>
  );
}
