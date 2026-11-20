import Link from '@/components/SiteLink';
import { FOREIGN_RANKINGS, foreignRankingPath } from '@/lib/foreignRankings';
import './foreign-ranking-links.css';

export default function ForeignRankingLinks({ current, residentsOnly = false }: { current?: string; residentsOnly?: boolean }) {
  return <nav aria-label="外国人住民・教育環境のランキング" className="fr-rank-links">
    <h2 className="rk-h2">外国人住民・教育環境を数値で比較</h2>
    <ul>{FOREIGN_RANKINGS.filter(d => d.slug !== current && (!residentsOnly || d.theme === 'residents')).map(d =>
      <li key={d.slug}><Link href={foreignRankingPath(d)}>{d.title}</Link>（{d.geography === 'prefecture' ? '都道府県別' : '市区町村別'}）</li>)}</ul>
  </nav>;
}
