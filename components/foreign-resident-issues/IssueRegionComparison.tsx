'use client';
import { useState } from 'react';
import { formatIssueValue, issueComparisonColumns, issueComparisonRows, type IssuesDataset, type IssueTheme } from '@/lib/foreignResidentIssues';

export default function IssueRegionComparison({ data, theme, year, codes, onChange, loading }: {
  data: IssuesDataset; theme: IssueTheme; year: number; codes: string[]; onChange(codes: string[]): void; loading: boolean;
}) {
  const [query, setQuery] = useState('');
  const prefecture = theme === 'education';
  const regions = prefecture ? data.prefectures.map(p => ({ code: p.code, name: p.name, pref: p.slug })) : data.municipalities;
  const normalized = query.normalize('NFKC').trim();
  const matches = normalized ? regions.filter(r => `${r.name}${data.prefectures.find(p => p.slug === r.pref)?.name}${r.code}`.includes(normalized)).slice(0, 10) : [];
  const selected = codes.flatMap(code => regions.find(r => r.code === code) ?? []);
  const columns = issueComparisonColumns(theme);
  const rows = issueComparisonRows(data, theme, year, '').filter(r => codes.includes(r.code));
  const years = new Set([year, year - 1, year - 5, year - 10]);
  const sourceIds = new Set(theme === 'residents' ? data.resident.filter(r => codes.includes(r.municipalityCode) && years.has(r.year)).flatMap(r => r.sourceIds)
    : theme === 'education' ? data.education.filter(r => codes.includes(r.code) && r.year === year).flatMap(r => r.sourceIds)
    : data.guidance.filter(r => codes.includes(r.code) && r.year === year).flatMap(r => r.sourceIds));
  return <section className="fri-region-compare" aria-label="選択地域の比較">
    <h2>最大3{prefecture ? '都道府県' : '自治体'}を並べて比較</h2>
    <p>{year}{theme === 'residents' ? '年1月1日' : '年度・5月1日'}。{prefecture ? '学校所在地別・国公私立計' : theme === 'guidance' ? '市町村教育委員会所管の公立校' : '住民基本台帳'}。異なる集計単位は同じ表に混ぜません。</p>
    <label>比較する地域を検索<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={prefecture ? '例：愛知県' : '例：川口市、東京都'} /></label>
    {!!normalized && <ul className="fri-compare-matches">{matches.map(r => <li key={r.code}><button type="button" disabled={codes.includes(r.code) || codes.length >= 3} onClick={() => { onChange([...codes, r.code]); setQuery(''); }}>{r.name}（{r.code}）を比較に追加</button></li>)}{!matches.length && <li>該当する地域がありません。</li>}</ul>}
    <ul className="fri-compare-chips">{selected.map(r => <li key={r.code}>{r.name}<button type="button" aria-label={`${r.name}を比較から削除`} onClick={() => onChange(codes.filter(c => c !== r.code))}><span aria-hidden="true">×</span></button></li>)}</ul>
    {codes.length < 2 ? <p>検索から2〜3地域を選択してください。候補はURLに保存されます。</p> : loading ? <p role="status">比較データを読み込んでいます…</p> : <>
      <div className="fri-table-scroll" role="region" aria-label="選択地域の指標比較表" tabIndex={0}><table><thead><tr><th scope="col">指標</th>{selected.map(r => <th scope="col" key={r.code}>{r.name}</th>)}</tr></thead><tbody>{columns.map(c => <tr key={c.key}><th scope="row">{c.label}</th>{selected.map(r => <td key={r.code}>{formatIssueValue(rows.find(row => row.code === r.code)?.values[c.key] ?? null, c.unit)}</td>)}</tr>)}</tbody></table></div>
      <p className="fri-caption">欠損や未公表は0に置き換えません。数値だけで教育水準・安全性・住みやすさを評価しません。</p>
      {theme === 'guidance' && <details><summary>比較地域の日本語指導体制</summary>{selected.map(r => <div key={r.code}><h3>{r.name}</h3><ul>{[...new Set(data.guidance.filter(g => g.code === r.code && g.year === year).flatMap(g => g.support))].map(text => <li key={text}>{text}</li>)}</ul><p>回答がない場合は、支援の不存在を意味しません。</p></div>)}</details>}
      <details><summary>比較データの出典・定義</summary>{data.sources.filter(s => sourceIds.has(s.id)).map(s => <p key={s.id}><a href={s.sourceUrl} target="_blank" rel="noopener noreferrer">{s.sourceName}</a>／基準日 {s.period}<br />{s.definition}</p>)}</details>
    </>}
  </section>;
}
