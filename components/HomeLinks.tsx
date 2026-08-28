// トップに置くクロール可能な内部リンク帯（サーバーコンポーネント＝初期HTMLに出力）。
// トップページでは地図下のコンテンツとして通常フローに表示する（メインコピーは
// ファーストビューのヒーロー側が持つため、ここには置かない）。

import Link from "next/link";
import { RANKINGS, muniLevelOnly, type RankingCategory } from "@/lib/rankings";
import { listAllAcrossPrefs } from "@/lib/metrics";
import { MAP_HUBS } from "@/lib/siteNav";
import PrefRegionPicker from "@/components/home/PrefRegionPicker";

export type PopularMuni = { pref: string; code: string; name: string };

// 「人気の自治体」= 人口上位（市区町村のみ、政令市の区は除外）。内部リンクを主要都市に
// 集約する。ビルド時のみフルデータを使い、クライアントには小さな popular 配列だけを渡す
// （トップと /map で共用）。
export async function getPopularMunis(limit = 12): Promise<PopularMuni[]> {
  const munis = muniLevelOnly(await listAllAcrossPrefs());
  return munis
    .slice()
    .sort((a, b) => b.population - a.population)
    .slice(0, limit)
    .map((m) => ({ pref: m.pref, code: m.code, name: m.name }));
}

// トップに出す代表ランキング（カテゴリごとに数件へ絞り、全量は /ranking に送る）。
// slug は lib/rankings.ts の定義に一致させる（URLは変更しない）。
const RANKING_PICKS: Array<{ category: RankingCategory; slugs: string[] }> = [
  { category: "住まい", slugs: ["rent-cheap", "land-price-high", "vacancy-high"] },
  { category: "人口・まち", slugs: ["population-most", "population-growth", "population-density"] },
  { category: "子育て・生活", slugs: ["waitlist-zero"] },
];

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
        {/* 地方タブ → 都道府県の2段階。47県リンクは全地方ぶん常にHTMLに存在する */}
        <PrefRegionPicker />
      </section>

      <section className="home-links-block">
        <h2 className="home-links-h">地図で見る</h2>
        {/* ハブ一覧は lib/siteNav.ts が単一ソース。prefetch 無効はハブ1本 ~78KB gzip の
            viewport 先読みを避けるため（SiteFooter と同方針） */}
        <ul className="home-chip-row">
          {MAP_HUBS.map(({ href, label }) => (
            <li key={href}><Link href={href} prefetch={false} className="home-chip">{label}</Link></li>
          ))}
        </ul>
      </section>

      <section className="home-links-block">
        <h2 className="home-links-h">ランキングで比較</h2>
        {/* トップでは代表項目のみカテゴリ別に表示し、全14種は /ranking で見せる */}
        {RANKING_PICKS.map(({ category, slugs }) => (
          <div key={category} className="home-rank-cat">
            <p className="home-rank-cat-label">{category}</p>
            <ul className="home-chip-row">
              {slugs.map((slug) => {
                const r = RANKINGS.find((x) => x.slug === slug);
                if (!r) return null;
                return (
                  <li key={r.slug}>
                    <Link href={`/ranking/${r.slug}`} className="home-chip">{r.shortLabel}</Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <p className="home-rank-all">
          <Link href="/ranking">すべてのランキングを見る（全{RANKINGS.length}種） →</Link>
        </p>
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

      {/* about / privacy への導線と © は直下の共通フッター（SiteFooter）が持つ */}
      <p className="home-links-foot">
        出典: e-Stat（住宅・土地統計調査／国勢調査）・地価公示／地価調査・不動産情報ライブラリ・こども家庭庁・出入国在留管理庁 在留外国人統計（e-Stat）
      </p>
    </div>
  );
}
