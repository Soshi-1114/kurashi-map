'use client';

import { useState } from 'react';
import Link from '@/components/SiteLink';
import DisplayAd from '@/components/monetization/DisplayAd';
import { formatIssueValue } from '@/lib/foreignResidentIssues';
import type { ForeignRankingDef, ForeignRankingRow } from '@/lib/foreignRankings';

export default function ForeignRankingTable({ rows, def, year }: {
  rows: ForeignRankingRow[]; def: ForeignRankingDef; year: number;
}) {
  const [query, setQuery] = useState('');
  // A search may remove the ad, but never remount/request it again in this document.
  const [hasSearched, setHasSearched] = useState(false);
  const normalize = (s: string) => s.normalize('NFKC').trim().toLocaleLowerCase('ja');
  const normalized = normalize(query);
  const matches = normalized ? rows.filter(r => normalize(`${r.prefName}${r.name}${r.code}`).includes(normalized)) : rows.filter(r => r.value !== null);
  const shown = normalized ? matches : matches.slice(0, def.theme === 'residents' ? 100 : 47);
  const table = (items: ForeignRankingRow[], suffix: string) => <div className="fr-rank-scroll" role="region" aria-label={`${suffix}の順位表`} tabIndex={0}>
    <table className="fr-rank-table"><caption>{year}年・{def.label} {suffix}（全国順位）</caption>
      <thead><tr><th scope="col">順位</th><th scope="col">{def.theme === 'residents' ? '市区町村' : '都道府県'}</th>
        <th scope="col">{def.theme === 'residents' ? '前年比増減' + (def.unit === '%' ? '率' : '数') : '外国籍割合'}</th>
        <th scope="col">{def.theme === 'residents' ? `${year - 1}年人数` : '外国籍人数'}</th>
        <th scope="col">{def.theme === 'residents' ? `${year}年人数` : '在籍者総数'}</th></tr></thead>
      <tbody>{items.map(row => <tr key={row.code}><td>{row.rank ?? '—'}</td>
        <th scope="row"><Link href={row.mapHref}>{row.name}</Link>{def.theme === 'residents' && <small>{row.prefName}</small>}</th>
        <td className="fr-rank-value">{row.value === null ? '算出不可' : formatIssueValue(row.value, def.unit)}</td>
        <td>{formatIssueValue(def.theme === 'residents' ? row.before : row.after)}</td>
        <td>{formatIssueValue(def.theme === 'residents' ? row.after : row.before)}</td></tr>)}</tbody>
    </table></div>;
  return <section aria-label="全国ランキング" className="fr-rank-results">
    <label className="fr-rank-search">{def.theme === 'residents' ? '市区町村・都道府県を検索' : '都道府県を検索'}
      <input type="search" value={query} onChange={e => { setQuery(e.target.value); if (normalize(e.target.value)) setHasSearched(true); }} placeholder={def.theme === 'residents' ? '例：川口市、埼玉県' : '例：愛知県'} /></label>
    <p role="status">{normalized ? `検索結果 ${matches.length}件（全国順位を維持）` : def.theme === 'residents' ? '上位100件を掲載。検索は全自治体が対象です。' : '47都道府県を掲載しています。'} 地域名から地図・詳細を確認できます。</p>
    <p className="fr-rank-mobile-copy fr-rank-note">表は横にスクロールできます。</p>
    {!shown.length ? <p>該当する地域がありません。地域名を変えて検索してください。</p> : <>
      <div className="fr-rank-top">
        {table(shown.slice(0, 10), normalized ? '検索結果' : '上位10件')}
        {!hasSearched && rows.filter(r => r.value !== null).length >= 10 && <div className="fr-rank-ad"><DisplayAd placement="ranking" /></div>}
      </div>
      {shown.length > 10 && table(shown.slice(10), '11件目以降')}
    </>}
    <p className="fr-rank-note">同じ数値は同順位。順位は丸める前の数値で判定します。欠損{def.theme === 'residents' && def.unit === '%' ? '・前年0人' : ''}は算出不可として順位に含めず、地域名で検索すると確認できます。</p>
  </section>;
}
