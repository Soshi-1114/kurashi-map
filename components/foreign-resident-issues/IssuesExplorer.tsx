"use client";

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from '@/components/SiteLink';
import { educationValue, formatIssueValue, issueChartScale, issueComparisonColumns, issueComparisonRows, sortIssueComparison, issueRank, metricLag, prefectureResidentRows, residentRows, RESIDENT_METRICS,
  type IssuesDataset, type ResidentMetric, type IssueMapRow } from '@/lib/foreignResidentIssues';
import { ForeignIssueClient, type IssueManifest } from '@/lib/foreignIssueClient';
import LocalEducationNotes from './LocalEducationNotes';
import IssueRegionComparison from './IssueRegionComparison';
import { DIVERGING, SEQUENTIAL, mapThresholds } from './IssuesMap';

const IssuesMap = dynamic(() => import('./IssuesMap'), { ssr: false, loading: () => <div className="fri-map-loading">地図を準備しています…</div> });
type Tab = 'residents' | 'education' | 'guidance';
const GUIDANCE_METRICS = { needsForeign: '日本語指導が必要な人数（外国籍）', needsJapanese: '日本語指導が必要な人数（日本国籍）', receivingForeign: '配慮に基づく指導を受けている人数（外国籍）' } as const;
const GUIDANCE_OPTIONS = { needsForeign: '必要人数（外国籍）', needsJapanese: '必要人数（日本国籍）', receivingForeign: '指導実施人数（外国籍）' } as const;

export default function IssuesExplorer() {
  const client = useMemo(() => new ForeignIssueClient(), []);
  const [manifest, setManifest] = useState<IssueManifest | null>(null);
  const [dataKey, setDataKey] = useState('');
  const [compareMunicipalities, setCompareMunicipalities] = useState<string[]>([]);
  const [comparePrefectures, setComparePrefectures] = useState<string[]>([]);
  const [data, setData] = useState<IssuesDataset | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [tab, setTab] = useState<Tab>('residents');
  const [year, setYear] = useState(0);
  const [educationYear, setEducationYear] = useState(0);
  const [guidanceYear, setGuidanceYear] = useState(0);
  const [pref, setPref] = useState('');
  const [metric, setMetric] = useState<ResidentMetric>('ratio');
  const [stage, setStage] = useState<'elementary' | 'junior'>('elementary');
  const [educationMetric, setEducationMetric] = useState<'count' | 'ratio'>('ratio');
  const [guidanceMetric, setGuidanceMetric] = useState<keyof typeof GUIDANCE_METRICS>('needsForeign');
  const [selected, setSelected] = useState('');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(50);
  const [restored, setRestored] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const residentYears = useMemo(() => manifest?.years.residents ?? [], [manifest]);
  const years = useMemo(() => manifest?.years[tab] ?? [], [manifest, tab]);
  const displayYear = tab === 'residents' ? year : tab === 'education' ? educationYear : guidanceYear;

  const compareCodes = tab === 'education' ? comparePrefectures : compareMunicipalities;
  const historyCodes = useMemo(() => [...new Set([selected, ...compareCodes].filter(Boolean))].sort(), [selected, compareCodes]);
  const requestKey = JSON.stringify([tab, displayYear, historyCodes]);
  const loading = dataKey !== requestKey;

  useEffect(() => {
    let cancelled = false;
    client.manifest().then(d => {
      if (cancelled) return;
      setManifest(d); setError('');
      const p = new URLSearchParams(window.location.search);
      if (p.get('tab') === 'education') setTab('education');
      if (p.get('tab') === 'guidance') setTab('guidance');
      const gm = p.get('guidanceMetric') ?? ''; if (Object.hasOwn(GUIDANCE_METRICS, gm)) setGuidanceMetric(gm as keyof typeof GUIDANCE_METRICS);
      const y = Number(p.get('year'));
      const chooseYear = (theme: Tab) => { const available = d.years[theme]; return (p.get('tab') ?? 'residents') === theme && available.includes(y) ? y : available.at(-1)!; };
      setYear(chooseYear('residents')); setEducationYear(chooseYear('education')); setGuidanceYear(chooseYear('guidance'));
      const pr = p.get('pref') ?? ''; if (d.prefectures.some(x => x.slug === pr)) setPref(pr);
      const met = p.get('metric') ?? ''; if (Object.hasOwn(RESIDENT_METRICS, met)) setMetric(met as ResidentMetric);
      if (p.get('stage') === 'junior') setStage('junior');
      if (p.get('educationMetric') === 'count') setEducationMetric('count');
      const code = p.get('code') ?? '';
      const muni = d.municipalities.find(m => m.code === code);
      if (p.get('tab') !== 'education' && muni) { setSelected(code); setPref(muni.pref); }
      else if (d.prefectures.some(x => x.code === code)) setSelected(code);
      const codes = (key: string, available: { code: string }[]) => [...new Set((p.get(key) ?? '').split(',').filter(c => available.some(r => r.code === c)))].slice(0, 3);
      setCompareMunicipalities(codes('compareMunicipalities', d.municipalities)); setComparePrefectures(codes('comparePrefectures', d.prefectures));
      setRestored(true);
    }).catch(() => { if (!cancelled) setError('統計データを取得できませんでした。再試行してください。'); });
    return () => { cancelled = true; };
  }, [retry, client]);
  useEffect(() => {
    if (!manifest || !restored) return;
    let cancelled = false;
    client.load(manifest, tab, displayYear, historyCodes).then(d => {
      if (!cancelled) { setData(d); setDataKey(requestKey); setError(''); }
    }).catch(() => { if (!cancelled) setError('統計データを取得できませんでした。再試行してください。'); });
    return () => { cancelled = true; };
  }, [client, manifest, restored, tab, displayYear, historyCodes, requestKey, retry]);
  useEffect(() => {
    if (!restored) return;
    const p = new URLSearchParams({ tab, year: String(displayYear), metric, stage, educationMetric, guidanceMetric });
    if (pref && tab !== 'education') p.set('pref', pref);
    if (selected) p.set('code', selected);
    if (compareMunicipalities.length) p.set('compareMunicipalities', compareMunicipalities.join(','));
    if (comparePrefectures.length) p.set('comparePrefectures', comparePrefectures.join(','));
    window.history.replaceState(null, '', `${window.location.pathname}?${p}`);
  }, [tab, displayYear, metric, stage, educationMetric, guidanceMetric, pref, selected, restored, compareMunicipalities, comparePrefectures]);

  const rows = useMemo((): IssueMapRow[] => {
    if (!data) return [];
    if (tab === 'residents') return residentRows(data, year, metric, pref);
    if (tab === 'guidance') {
      const index = new Map(data.guidance.filter(r => r.stage === stage && r.year === guidanceYear).map(r => [r.code, r]));
      return data.municipalities.filter(m => !pref || m.pref === pref).map(m => ({ ...m, value: index.get(m.code)?.[guidanceMetric] ?? null }));
    }
    return data.prefectures.map(p => ({ code: p.code, name: p.name, pref: p.slug,
      value: educationValue(data.education.find(r => r.code === p.code && r.stage === stage && r.year === educationYear), educationMetric) }));
  }, [data, tab, year, metric, pref, stage, educationMetric, guidanceMetric, educationYear, guidanceYear]);
  const mapRows = useMemo(() => {
    if (data && !pref && tab === 'residents') return prefectureResidentRows(data, year, metric);
    if (data && !pref && tab === 'guidance') return data.prefectures.map(p => {
      const outside = new Set(manifest?.excludedMunicipalityCodes ?? []);
      const members = rows.filter(r => r.pref === p.slug && !outside.has(r.code));
      return { code: p.code, name: p.name, pref: p.slug, value: members.every(r => r.value !== null) ? members.reduce((n,r) => n+r.value!,0) : null };
    });
    return rows;
  }, [data, tab, year, metric, pref, rows, manifest]);
  const ranked = useMemo(() => issueRank(rows), [rows]);
  const activeColumn = tab === 'residents' ? metric : `${stage}:${tab === 'education' ? educationMetric : guidanceMetric}`;
  const comparisonColumns = useMemo(() => issueComparisonColumns(tab), [tab]);
  const comparisonRows = useMemo(() => data ? issueComparisonRows(data, tab, displayYear, pref) : [], [data, tab, displayYear, pref]);
  const visible = useMemo(() => sortIssueComparison(comparisonRows, activeColumn).filter(r => `${r.name} ${data?.prefectures.find(p => p.slug === r.pref)?.name} ${r.code}`.includes(query.trim())), [comparisonRows, activeColumn, query, data]);
  const choice = rows.find(r => r.code === selected);
  const unit = tab === 'residents' ? RESIDENT_METRICS[metric].unit : tab === 'guidance' ? '人' : educationMetric === 'ratio' ? '%' : '人';
  const label = tab === 'residents' ? RESIDENT_METRICS[metric].label : tab === 'guidance' ? GUIDANCE_METRICS[guidanceMetric] : `外国籍${stage === 'elementary' ? '児童' : '生徒'}${educationMetric === 'ratio' ? '割合' : '数'}`;
  const diverging = tab === 'residents' && (metric.startsWith('change') || metric.startsWith('rate'));
  const thresholds = mapThresholds(mapRows, diverging);
  const colors = diverging ? DIVERGING : SEQUENTIAL;
  const current = data?.resident.find(r => r.municipalityCode === selected && r.year === year);
  const edu = data?.education.find(r => r.code === selected && r.stage === stage && r.year === educationYear);
  const guidance = data?.guidance.find(r => r.code === selected && r.stage === stage && r.year === guidanceYear);
  const sourceIds = tab === 'residents' ? [...(current?.sourceIds ?? []), ...(data?.resident.find(r => r.municipalityCode === selected && r.year === year - metricLag(metric))?.sourceIds ?? [])] : tab === 'guidance' ? guidance?.sourceIds ?? [] : edu?.sourceIds ?? [];
  const chosenSources = data?.sources.filter(s => sourceIds.includes(s.id)) ?? [];
  const series = useMemo(() => {
    if (!data || tab === 'guidance' || !selected) return [];
    if (tab === 'education') return (manifest?.years.education ?? []).map(y => ({ year: y, value: educationValue(data.education.find(r => r.code === selected && r.stage === stage && r.year === y), educationMetric) }));
    return residentYears.map(y => ({ year: y, value: residentRows(data, y, metric, pref).find(r => r.code === selected)?.value ?? null }));
  }, [data, tab, selected, metric, pref, residentYears, manifest, stage, educationMetric]);
  function select(code: string) {
    if (tab !== 'education' && code.length === 2 && data) {
      setPref(data.prefectures.find(p => p.code === code)?.slug ?? ''); setSelected('');
    } else setSelected(code);
  }
  function changeTab(next: Tab) { setTab(next); setSelected(''); setQuery(''); setLimit(50); if (next === 'guidance' && !pref) setPref('saitama'); }
  function selectColumn(key: string) {
    if (tab === 'residents') setMetric(key as ResidentMetric);
    else {
      const [school, nextMetric] = key.split(':');
      setStage(school as 'elementary' | 'junior');
      if (tab === 'education') setEducationMetric(nextMetric as 'count' | 'ratio');
      else setGuidanceMetric(nextMetric as keyof typeof GUIDANCE_METRICS);
    }
    setLimit(50);
  }

  if (error) return <div className="fri-empty" role="alert">{error} <button className="fri-action" onClick={() => setRetry(x => x + 1)}>再試行</button></div>;
  if (!data) return <div className="fri-map-loading" role="status">公的統計を読み込んでいます…</div>;
  return <section className="fri-explorer" aria-label="地図と統計を調べる" aria-busy={loading}>
    <div className="fri-tabs" role="group" aria-label="表示テーマ">
      <button aria-pressed={tab === 'residents'} onClick={() => changeTab('residents')}>外国人住民の増減</button>
      <button aria-pressed={tab === 'education'} onClick={() => changeTab('education')}>学校の教育環境</button>
      <button aria-pressed={tab === 'guidance'} onClick={() => changeTab('guidance')}>日本語指導・支援</button>
    </div>
    <button className="fri-filter-toggle" type="button" aria-expanded={filtersOpen} aria-controls="fri-display-controls" onClick={() => setFiltersOpen(open => !open)}>
      <span><strong>{tab === 'residents' ? `${year}年` : `${displayYear}年度`}・{tab === 'education' ? (stage === 'elementary' ? '小学校' : '中学校') : data.prefectures.find(p => p.slug === pref)?.name ?? '全国'}{tab === 'guidance' ? `・${stage === 'elementary' ? '小学校' : '中学校'}` : ''}</strong><span>{tab === 'guidance' ? GUIDANCE_OPTIONS[guidanceMetric] : label}</span></span>
      <span className="fri-filter-action">{filtersOpen ? '条件を閉じる' : '条件を変更'}<span aria-hidden="true">{filtersOpen ? '−' : '＋'}</span></span>
    </button>
    <div id="fri-display-controls" className={`fri-controls${filtersOpen ? ' is-open' : ''}`}>
      <label>基準年<select aria-label="基準年" value={displayYear} onChange={e => (tab === 'residents' ? setYear : tab === 'education' ? setEducationYear : setGuidanceYear)(Number(e.target.value))}>
        {years.slice().reverse().map(y => <option key={y} value={y}>{y}{tab !== 'residents' ? '年度（5月1日）' : '年（1月1日）'}</option>)}
      </select></label>
      {tab === 'residents' ? <>
        <label>地域<select aria-label="地域" value={pref} onChange={e => { setPref(e.target.value); setSelected(''); setQuery(''); }}><option value="">全国（県を選ぶと自治体へ）</option>{data.prefectures.slice().sort((a,b) => a.code.localeCompare(b.code)).map(p => <option key={p.code} value={p.slug}>{p.name}</option>)}</select></label>
        <label>指標<select aria-label="指標" value={metric} onChange={e => setMetric(e.target.value as ResidentMetric)}>{Object.entries(RESIDENT_METRICS).map(([key, m]) => <option key={key} value={key}>{m.label}</option>)}</select></label>
      </> : <>
        {tab === 'guidance' && <label>地域<select aria-label="地域" value={pref} onChange={e => { setPref(e.target.value); setSelected(''); }}><option value="">全国（市町村所管校のみ）</option>{data.prefectures.slice().sort((a,b) => a.code.localeCompare(b.code)).map(p => <option key={p.code} value={p.slug}>{p.name}</option>)}</select></label>}
        <label>学校種<select aria-label="学校種" value={stage} onChange={e => setStage(e.target.value as typeof stage)}><option value="elementary">小学校</option><option value="junior">中学校</option></select></label>
        {tab === 'education' ? <label>指標<select aria-label="教育指標" value={educationMetric} onChange={e => setEducationMetric(e.target.value as 'count' | 'ratio')}><option value="ratio">外国籍児童生徒の割合</option><option value="count">外国籍児童生徒の人数</option></select></label> : <label>指標<select aria-label="日本語指導指標" value={guidanceMetric} onChange={e => setGuidanceMetric(e.target.value as keyof typeof GUIDANCE_METRICS)}>{Object.entries(GUIDANCE_OPTIONS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>}
      </>}
    </div>
    {loading && <p role="status">選択した地域・年度の統計データを読み込んでいます…</p>}
    <div className="fri-map-heading"><strong>{tab === 'education' ? '都道府県別' : pref ? data.prefectures.find(p => p.slug === pref)?.name : '全国・都道府県別'}　{label}</strong><span>{tab === 'education' ? `${displayYear}年5月1日／国公私立計` : tab === 'guidance' ? `${displayYear}年5月1日／市町村教育委員会所管の公立校` : `${year}年1月1日／住民基本台帳`}</span></div>
    <div className="fri-workspace">
      <div>
        <IssuesMap rows={loading ? [] : mapRows} pref={tab !== 'education' ? pref : ''} selected={selected} onSelect={select} diverging={diverging} />
        <div hidden={loading} className="fri-legend" aria-label="地図の凡例">{colors.map((c, i) => <span key={c}><i style={{ background: c }} />{diverging && i === 2 ? '増減なし' : i === 0 ? `${formatIssueValue(thresholds[0], unit)}未満` : i === 4 ? `${formatIssueValue(thresholds[3], unit)}以上` : diverging && i === 3 ? `0超〜${formatIssueValue(thresholds[3], unit)}未満` : `${formatIssueValue(thresholds[i - 1], unit)}〜${formatIssueValue(thresholds[i], unit)}未満`}</span>)}<span><i style={{ background: '#dce1e6' }} />データなし</span></div>
        <p className="fri-caption">{tab === 'education' ? '学校所在地の集計です。居住自治体別の値ではありません。' : tab === 'guidance' ? '市町村教育委員会所管の公立校のみ。県所管校・国私立校は含みません。県の色は市町村分の合計です。' : !pref ? '県を選択すると市区町村を表示します。県の値は現在の自治体コードで比較可能なデータの合計です。' : '政令指定都市は市全体、東京都の特別区は区単位で表示します。'}</p>
      </div>
      <aside hidden={loading} className="fri-detail" aria-label="選択地域の詳細" aria-live="polite">
        {choice ? <>
          <p className="fri-caption">{data.prefectures.find(p => p.slug === choice.pref)?.name}{tab === 'education' ? '・国公私立計' : ''}</p>
          <h2>{choice.name}</h2><p>{label}</p><strong className="fri-value">{formatIssueValue(choice.value, unit)}</strong>
          <p>{choice.value === null ? 'この期間の比較に必要なデータがそろっていません。' : `${tab !== 'education' && pref ? '県内' : tab === 'education' ? '都道府県' : '全国'} ${ranked.findIndex(r => r.value === choice.value) + 1}位／${ranked.length.toLocaleString()}地域（高い順）`}</p>
          {tab === 'residents' && <dl className="fri-facts"><div><dt>外国人住民数</dt><dd>{formatIssueValue(current?.foreign ?? null)}</dd></div><div><dt>総人口（同じ基準日）</dt><dd>{formatIssueValue(current?.population ?? null)}</dd></div></dl>}
          {tab === 'education' && <dl className="fri-facts"><div><dt>外国籍児童生徒数</dt><dd>{formatIssueValue(edu?.foreign ?? null)}</dd></div><div><dt>在籍総数（同じ学校種）</dt><dd>{formatIssueValue(edu?.total ?? null)}</dd></div></dl>}
          {series.length > 0 && <Trend series={series} unit={unit} />}
          {tab === 'guidance' && <><dl className="fri-facts"><div><dt>必要人数（外国籍）</dt><dd>{formatIssueValue(guidance?.needsForeign ?? null)}</dd></div><div><dt>必要人数（日本国籍）</dt><dd>{formatIssueValue(guidance?.needsJapanese ?? null)}</dd></div><div><dt>配慮に基づく指導（外国籍）</dt><dd>{formatIssueValue(guidance?.receivingForeign ?? null)}</dd></div></dl><h3>教育委員会の指導体制</h3>{guidance?.support.length ? <ul>{guidance.support.map(s => <li key={s}>{s}</li>)}</ul> : <p>収録された該当回答はありません。支援の不存在を意味しません。</p>}<p className="fri-caption">市町村教育委員会が所管する公立校の集計です。在籍する外国籍児童生徒全員の数とは異なります。</p></>}
          <p><button className="fri-action" type="button" disabled={compareCodes.includes(choice.code) || compareCodes.length >= 3} onClick={() => (tab === 'education' ? setComparePrefectures : setCompareMunicipalities)([...compareCodes, choice.code])}>{compareCodes.includes(choice.code) ? '比較に追加済み' : 'この地域を比較に追加'}</button></p>
          {tab !== 'education' && <p><Link href={`/area/${choice.pref}/${choice.code}`}>自治体の住環境データを見る</Link></p>}
          {chosenSources.map(s => <p className="fri-source" key={s.id}><a href={s.sourceUrl} target="_blank" rel="noopener noreferrer">{s.sourceName}</a><br />基準日 {s.period}／公表日 {s.sourcePublishedAt ?? '未確認'}<br />{s.definition}</p>)}
          {tab === 'education' && <p className="fri-caption">日本語指導の必要人数・支援体制は「日本語指導・支援」で確認できます。人数・割合だけで教育水準や安全性を評価できません。</p>}
        </> : <><h2>地域を選んで詳しく見る</h2><p>地図、または下の一覧から選択してください。年度・出典・人数を一緒に確認できます。</p><p className="fri-caption">灰色はデータなしです。未公表・秘匿・比較できない期間を0として扱いません。</p></>}
      </aside>
    </div>
    <IssueRegionComparison data={data} theme={tab} year={displayYear} codes={compareCodes} onChange={tab === 'education' ? setComparePrefectures : setCompareMunicipalities} loading={loading} />
    {tab === 'education' && <LocalEducationNotes data={data} />}
    <section hidden={loading} className="fri-ranking" aria-labelledby="fri-table-title">
      <div className="fri-table-heading"><div><h2 id="fri-table-title">{tab === 'education' ? '都道府県別' : pref ? '県内の自治体' : '全国の自治体'}を数値で比較</h2><p>{label}の高い順。同じ値は同順位、データなしは末尾。有効データ {ranked.length.toLocaleString()}／{rows.length.toLocaleString()}地域。</p><p className="fri-desktop-only">指標の見出しを押すと、その指標の高い順に並び替わり、地図の指標も切り替わります。</p></div><label>地域名・コードで検索<input type="search" value={query} onChange={e => { setQuery(e.target.value); setLimit(50); }} placeholder="例：川口、埼玉県、11203" /></label></div>
      <div className="fri-table-scroll" role="region" aria-label="地域別の全指標比較表" tabIndex={0}><table className="fri-comparison-table"><thead><tr><th scope="col">順位</th><th scope="col" className="fri-region-column">地域</th>{comparisonColumns.map(column => <th key={column.key} scope="col" aria-sort={column.key === activeColumn ? 'descending' : 'none'} className={`fri-metric-column${column.key === activeColumn ? ' is-active' : ' fri-comparison-extra'}`}><button type="button" aria-label={`${column.label}の高い順に並べ替え`} onClick={() => selectColumn(column.key)}>{column.label}<span aria-hidden="true">{column.key === activeColumn ? ' ▼' : ' ↕'}</span></button></th>)}</tr></thead><tbody>{visible.slice(0, limit).map(row => <tr key={row.code} className={row.code === selected ? 'is-selected' : ''}><td>{row.values[activeColumn] === null ? '—' : ranked.findIndex(r => r.value === row.values[activeColumn]) + 1}</td><th scope="row" className="fri-region-column"><button onClick={() => { if (tab !== 'education') setPref(row.pref); setSelected(row.code); }}>{row.name}</button><small>{tab !== 'education' ? data.prefectures.find(p => p.slug === row.pref)?.name : ''} {row.code}</small></th>{comparisonColumns.map(column => <td key={column.key} className={`fri-metric-column${column.key === activeColumn ? ' is-active' : ' fri-comparison-extra'}`}>{formatIssueValue(row.values[column.key] ?? null, column.unit)}</td>)}</tr>)}</tbody></table></div>
      {!visible.length && <p className="fri-empty">該当するデータがありません。年・指標・検索条件を変更してください。</p>}
      {visible.length > limit && <button className="fri-more" onClick={() => setLimit(n => n + 100)}>さらに100件表示（残り{visible.length - limit}件）</button>}
      <details><summary>データがない地域を確認（{rows.length - ranked.length}地域）</summary><ul>{rows.filter(r => r.value === null).map(r => <li key={r.code}><button onClick={() => { if (tab !== 'education') setPref(r.pref); setSelected(r.code); }}>{r.name}（{r.code}）</button></li>)}</ul></details>
    </section>
  </section>;
}

function Trend({ series, unit }: { series: { year: number; value: number | null }[]; unit: string }) {
  const values = series.flatMap(p => p.value === null ? [] : [p.value]);
  const { min, max, ticks } = issueChartScale(values, unit);
  // Reserve room for axis labels so five-digit counts fit even in the side panel.
  const firstYear = series[0]?.year ?? 0;
  const lastYear = series.at(-1)?.year ?? firstYear;
  const x = (year: number) => 64 + (year - firstYear) / (lastYear - firstYear || 1) * 240;
  const labels = [...new Set([firstYear, series[Math.floor(series.length / 2)]?.year ?? firstYear, lastYear])];
  const y = (v: number) => 120 - (v - min) / (max - min) * 100;
  // A missing observation breaks the line; never bridge it.
  const d = series.map((p, i) => p.value === null ? '' : `${i > 0 && series[i-1].value !== null ? 'L' : 'M'}${x(p.year)},${y(p.value)}`).join(' ');
  return <div className="fri-trend"><h3>年次推移</h3>{values.length ? <svg viewBox="0 0 320 155" role="img" aria-label={`選択指標の年次推移。縦軸の単位は${unit}。下の表で各年の数値を確認できます。`}>
    {ticks.map(tick => <g key={tick}>
      <line x1="64" y1={y(tick)} x2="304" y2={y(tick)} stroke="currentColor" opacity={tick === 0 ? 0.35 : 0.12} />
      <text x="58" y={y(tick)} textAnchor="end" dominantBaseline="middle">{formatIssueValue(tick, unit)}</text>
    </g>)}
    <path d={d} fill="none" stroke="var(--color-primary)" strokeWidth="2.5" />
    {series.map(p => p.value !== null && <circle key={p.year} cx={x(p.year)} cy={y(p.value)} r="3" fill="var(--color-primary)"><title>{p.year}年 {formatIssueValue(p.value, unit)}</title></circle>)}
    <g>{labels.map(year => <text key={year} x={x(year)} y="145" textAnchor={year === firstYear ? 'start' : year === lastYear ? 'end' : 'middle'}>{year}年</text>)}</g>
  </svg> : <p className="fri-caption">推移を表示できる年次データがありません。</p>}<details><summary>各年の数値を表示</summary><table><tbody>{series.map(p => <tr key={p.year}><th>{p.year}年</th><td>{formatIssueValue(p.value, unit)}</td></tr>)}</tbody></table></details></div>;
}
