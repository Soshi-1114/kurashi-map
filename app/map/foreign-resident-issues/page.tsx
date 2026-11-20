import type { Metadata } from 'next';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import PageShell from '@/components/PageShell';
import Link from '@/components/SiteLink';
import IssuesExplorer from '@/components/foreign-resident-issues/IssuesExplorer';
import ForeignRankingLinks from '@/components/foreign-resident-issues/ForeignRankingLinks';
import { formatIssueValue, issueRank, issueYears, residentRows, type IssuesDataset } from '@/lib/foreignResidentIssues';
import { serializeJsonLd } from '@/lib/jsonLd';
import { SITE, absoluteUrl } from '@/lib/site';
import 'maplibre-gl/dist/maplibre-gl.css';
import './issues.css';

const PATH = '/map/foreign-resident-issues';
const title = `外国人住民・教育環境・地域課題マップ - ${SITE.name}`;
const description = '住民基本台帳の外国人住民数・割合・年次増減と、学校基本調査の外国籍児童生徒割合を、公的データと出典を確認しながら地図で比較。地域・年度・統計の定義を区別して表示します。';
const interpretationNotice = '外国人住民の割合や学校の外国籍児童生徒割合は、治安・教育水準・住みやすさの評価ではありません。統計の相関から因果関係を断定しません。';
export const metadata: Metadata = {
  title, description, alternates: { canonical: PATH },
  openGraph: { type: 'website', title, description, url: absoluteUrl(PATH), siteName: SITE.name },
  twitter: { card: 'summary', title, description },
};

export default async function ForeignResidentIssuesPage() {
  const data: IssuesDataset = JSON.parse(await readFile(path.join(process.cwd(), 'public/foreign-resident-issues/dataset.json'), 'utf8'));
  const residentYears = issueYears(data, 'residents');
  const schoolYears = issueYears(data, 'education');
  const latestYear = residentYears.at(-1)!;
  const range = (years: number[]) => years.length > 1 ? `${years[0]}〜${years.at(-1)}` : String(years[0]);
  const top = issueRank(residentRows(data, latestYear, 'ratio', '')).slice(0, 5);
  const sources = data.sources.filter(s => s.year === latestYear || s.id.startsWith('school-') || s.id.startsWith('japanese-'));
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: SITE.name, item: absoluteUrl('/') },
      { '@type': 'ListItem', position: 2, name: '外国人住民・教育環境マップ', item: absoluteUrl(PATH) },
    ] },
    { '@type': 'Dataset', name: '外国人住民の年次推移と外国籍児童生徒の教育環境', description, url: absoluteUrl(PATH),
      creator: { '@type': 'Organization', name: SITE.name }, temporalCoverage: `${residentYears[0]}/${latestYear}`, spatialCoverage: '日本', isAccessibleForFree: true,
      citation: data.sources.map(s => s.sourceUrl) },
  ] };
  return <PageShell width="wide" innerClassName="fri-root" trail={[{ name: 'ホーム', href: '/' }, { name: '外国人住民・教育環境マップ' }]}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(ld) }} />
    <header className="fri-intro"><div><p className="fri-eyebrow">公的統計で地域を知る</p><h1>外国人住民と、<br className="fri-mobile-break" />地域の教育環境。</h1><p className="fri-intro-lead"><span className="fri-desktop-only">人数の変化と、学びを支える環境を地図から確かめる。<br />統計の年度・対象・出典をそろえて、地域の状況を比較します。</span><span className="fri-mobile-only">住民の変化と学校の状況を、公的データで比較。</span></p></div><div className="fri-intro-meta"><strong>住民：{range(residentYears)}年</strong><span>毎年1月1日現在</span><strong>学校：{range(schoolYears)}年度</strong><span>5月1日現在・都道府県別</span></div></header>
    <p className="fri-notice fri-desktop-only">{interpretationNotice}</p>
    <details className="fri-reading fri-mobile-only"><summary>データの見方・注意点</summary><p>{interpretationNotice}</p></details>
    <IssuesExplorer />
    <ForeignRankingLinks />
    <nav className="fri-related" aria-label="関連データ"><Link href="/map/foreign-ratio">既存の外国人住民比率マップ</Link><Link href="/ranking/foreign-ratio-high">在留外国人比率の既存ランキング</Link><span>既存ページとは統計・基準日が異なります。</span></nav>
    <section className="fri-method" aria-labelledby="fri-method-title"><h2 id="fri-method-title">データの読み方と収録範囲</h2>
      <div className="fri-method-grid"><div><h3>人口割合の分母をそろえる</h3><p>新ページは住民基本台帳の外国人住民数と総人口を使用します。既存の在留外国人統計と国勢調査による比率とは、対象・基準日が異なります。増減率は基準年の人数が0の場合、算出しません。</p><Link href="/map/foreign-ratio">既存の外国人住民比率マップ</Link></div><div><h3>教育データの地域粒度</h3><p>外国籍児童生徒の在籍人数・割合は都道府県別、国公私立計です。日本語指導は市町村教育委員会所管の公立校の必要人数・実施人数・指導体制を表示します。日本語指導の必要人数は外国籍在籍者の総数とは異なります。</p></div><div><h3>未収録の情報</h3><p>国籍・在留資格の構成、犯罪・地域事案、社会保障、相関分析、全国で定義のそろった自治体別の外国籍在籍割合は未収録です。学校基本調査の2023〜2025年度と、対象を明示した自治体公表資料を別々に表示します。犯罪認知件数を外国人による犯罪件数と解釈しません。学校単位や個人を特定する位置情報は掲載していません。</p></div></div>
      <details><summary>最新年の外国人住民割合を数値で確認</summary><table><caption>{latestYear}年1月1日、住民基本台帳。高い順の先頭5自治体。</caption><thead><tr><th>自治体</th><th>割合</th></tr></thead><tbody>{top.map(m => <tr key={m.code}><th><Link href={`/area/${m.pref}/${m.code}`}>{m.name}</Link></th><td>{formatIssueValue(m.value, '%')}</td></tr>)}</tbody></table></details>
    </section>
    <section className="fri-method"><h2>公的データの出典</h2><p>各表をKurashiMapが加工して表示。原典で示された欠損や秘匿は0に置き換えません。過去のコードが現在と一致しない地域は比較対象から除外します。</p><ul className="fri-source-list">{sources.map(s => <li key={s.id}><a href={s.sourceUrl} target="_blank" rel="noopener noreferrer">{s.sourceName}</a><span>基準日 {s.period}／公表日 {s.sourcePublishedAt ?? '未確認'}</span></li>)}</ul><p><a href="https://www.e-stat.go.jp/terms-of-use" target="_blank" rel="noopener noreferrer">e-Stat利用規約</a>　／　<a href="/foreign-resident-issues/dataset.json" download>収録データ・全年度の出典をダウンロード（JSON）</a></p></section>
  </PageShell>;
}
