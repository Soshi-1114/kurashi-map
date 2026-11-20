import type { Metadata } from 'next';
import PageShell from '@/components/PageShell';
import Link from '@/components/SiteLink';
import { loadForeignIssuesData } from '@/lib/foreignIssuesData';
import { buildForeignRanking, foreignRankingPath, type ForeignRankingDef } from '@/lib/foreignRankings';
import { formatIssueValue } from '@/lib/foreignResidentIssues';
import { serializeJsonLd } from '@/lib/jsonLd';
import { SITE, absoluteUrl } from '@/lib/site';
import ForeignRankingLinks from './ForeignRankingLinks';
import ForeignRankingTable from './ForeignRankingTable';
import ForeignRankingTracking from './ForeignRankingTracking';
import '@/app/league.css';
import './foreign-rankings.css';

export async function foreignRankingMetadata(def: ForeignRankingDef): Promise<Metadata> {
  const { year } = buildForeignRanking(await loadForeignIssuesData(), def);
  const title = `${def.title}【${year}年】｜${SITE.name}`;
  const description = `${year}年の公的統計で比較。${def.description}`;
  const url = absoluteUrl(foreignRankingPath(def));
  return { title, description, alternates: { canonical: url },
    openGraph: { type: 'website', title, description, url, siteName: SITE.name, locale: SITE.locale },
    twitter: { card: 'summary', title, description } };
}

export default async function ForeignRankingPage({ def }: { def: ForeignRankingDef }) {
  const { year, rows, eligibleCount, sources } = buildForeignRanking(await loadForeignIssuesData(), def);
  const resident = def.theme === 'residents';
  const period = resident ? `${year - 1}年1月1日 → ${year}年1月1日` : `${year}年5月1日現在`;
  const top = rows.find(r => r.rank === 1);
  const indexRows = rows.filter(r => r.value !== null).slice(0, resident ? 100 : 47);
  const defaultMap = top?.mapHref ?? '/map/foreign-resident-issues';
  const path = foreignRankingPath(def);
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: SITE.name, item: absoluteUrl('/') },
      { '@type': 'ListItem', position: 2, name: 'ランキング', item: absoluteUrl('/ranking') },
      { '@type': 'ListItem', position: 3, name: def.title, item: absoluteUrl(path) },
    ] },
    { '@type': 'ItemList', name: def.title, numberOfItems: indexRows.length,
      itemListElement: indexRows.map((r, i) => ({ '@type': 'ListItem', position: i + 1, name: `${resident ? r.prefName : ''}${r.name}`, url: absoluteUrl(r.mapHref) })) },
    { '@type': 'Dataset', name: `${def.title}（${year}年）`, description: def.description, url: absoluteUrl(path),
      temporalCoverage: resident ? `${year - 1}-01-01/${year}-01-01` : `${year}-05-01`, spatialCoverage: '日本',
      creator: { '@type': 'Organization', name: SITE.name }, citation: sources.map(s => s.sourceUrl),
      license: 'https://www.e-stat.go.jp/terms-of-use', isAccessibleForFree: true },
  ] };
  return <PageShell innerClassName="rk-root fr-rank-root" trail={[{ name: SITE.name, href: '/' }, { name: 'ランキング', href: '/ranking' }, { name: def.label }]}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(ld) }} />
    <ForeignRankingTracking slug={def.slug} geography={def.geography}>
      <header className="rk-hero rk-hero-compact">
        <h1 className="rk-title">{def.title}<span className="rk-title-sub">{year}年・{resident ? '市区町村別' : '47都道府県別'}</span></h1>
        <p className="rk-lead"><span className="fr-rank-desktop-copy">{def.description}</span><span className="fr-rank-mobile-copy">{resident ? '前年同日の外国人住民数を公的データで比較。' : '国公私立の在籍人数を都道府県別に比較。'}</span></p>
        <p className="fr-rank-period">{period} ／ 順位対象 {eligibleCount.toLocaleString()}{resident ? '自治体' : '都道府県'}</p>
        {top && <p className="fr-rank-answer">最も{resident ? (def.unit === '%' ? '増加率' : '増加数') + 'が大きい地域' : '割合が高い地域'}は、<strong>{resident ? top.prefName : ''}{top.name}（{formatIssueValue(top.value, def.unit)}）</strong>です{rows.filter(r => r.rank === 1).length > 1 ? '（同率1位あり）' : ''}。</p>}
        <p className="fr-rank-note">{resident ? '人数・増減は地域の人口動態を示す統計です。治安や住みやすさの評価ではありません。' : '外国籍児童生徒の割合は、学校の教育水準や安全性を評価する指標ではありません。'}</p>
      </header>
      <ForeignRankingTable rows={rows} def={def} year={year} />
      <nav className="rk-secondary-actions" aria-label="詳しく調べる"><Link className="rk-action rk-action-primary" href={defaultMap}>上位地域の推移・関連指標を地図で見る</Link></nav>
      <section className="rk-section"><h2 className="rk-h2">{resident ? '増加数と増加率の読み方' : '外国籍割合の集計対象と教育支援'}</h2>
        {resident ? <>
          <p>増加数は当年の外国人住民数から前年の人数を引いた値です。増加率は、その増減数を前年の外国人住民数で割って100を掛けています。減少した地域はマイナスで表示します。</p>
          <p>{def.unit === '%' ? '前年人数が少ない地域では、少人数の増加でも増加率が大きくなります。割合だけでなく、併記した前年・当年の人数も確認してください。前年0人の地域は増加率を算出しません。' : '増加数は地域の人口規模の影響を受けます。変化の大きさを相対的に比べる際は、増加率ランキングと地図の5年・10年の推移も確認してください。'}</p>
          <p>政令指定都市は親市、東京特別区は区で集計します。対象外地域・欠損は補間せず、前年と同一自治体コードで比較できる数値を使用します。在留外国人統計と国勢調査を組み合わせた既存の外国人比率ランキングとは、統計の対象・基準日が異なります。</p>
        </> : <>
          <p>{def.stage === 'elementary' ? '小学校の外国籍児童数を、小学校の在籍児童総数' : '中学校の外国籍生徒数を、中学校の在籍生徒総数'}で割って100を掛けた割合です。学校基本調査の同じ年度・国公私立計を使用し、学校所在地の都道府県で集計しています。住民登録地別の統計とは異なります。</p>
          <p>外国籍であることと、日本語指導を必要とすることは同じではありません。日本国籍の児童生徒にも日本語指導を必要とする場合があります。支援体制を知る際は、地図の「日本語指導・支援」も確認してください。</p>
          <p>市区町村・個別学校の外国籍在籍割合と過去年度の推移は、このランキングには収録していません。小学校と中学校では対象となる児童生徒が異なるため、それぞれの表で確認してください。</p>
        </>}
      </section>
      <ForeignRankingLinks current={def.slug} />
      <section className="rk-section fr-rank-sources"><h2 className="rk-h2">公的データの出典・定義</h2>
        <p>各公表表をKurashiMapが加工して表示しています。割合は小数点以下2桁まで表示し、順位は丸め前の値で判定します。未公表・欠損は0に置き換えません。</p>
        <ul>{sources.map(source => <li key={source.id}>
          <a href={source.sourceUrl} target="_blank" rel="noopener noreferrer">{source.sourceName}</a>
          <p>基準日：{source.period} ／ 公表日：{source.sourcePublishedAt ?? '未確認'} ／ データ取得・更新：{source.updatedAt}</p><p>{source.definition}</p>
        </li>)}</ul>
        <p><a href="https://www.e-stat.go.jp/terms-of-use" target="_blank" rel="noopener noreferrer">e-Stat利用規約</a> ／ <a href="/foreign-resident-issues/dataset.json" download>収録データ・出典をダウンロード（JSON）</a></p>
      </section>
      <nav className="rk-footnav" aria-label="関連リンク"><Link href="/ranking">ランキング一覧</Link><Link href="/map/foreign-resident-issues">外国人住民・教育環境マップ</Link></nav>
    </ForeignRankingTracking>
  </PageShell>;
}
