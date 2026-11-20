import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { educationValue, issueChartScale, issueComparisonColumns, issueComparisonRows, sortIssueComparison, percent, residentValue, residentRows, prefectureResidentRows, issueRank,
  type IssuesDataset, type ResidentObservation } from '@/lib/foreignResidentIssues';

const data: IssuesDataset = JSON.parse(readFileSync('public/foreign-resident-issues/dataset.json', 'utf8'));
const observation = (foreign: number | null, population: number | null = 100): ResidentObservation => ({ municipalityCode: '11203', year: 2026, foreign, population, status: 'published', sourceIds: [] });

describe('independent foreign resident metrics', () => {
  it('compares both school stages without mixing prefectures and municipalities', () => {
    expect(issueComparisonColumns('education')).toHaveLength(4);
    expect(issueComparisonColumns('residents')).toHaveLength(8);
    expect(issueComparisonColumns('guidance')).toHaveLength(6);
    const education = issueComparisonRows(data, 'education', 2026, 'saitama');
    expect(education).toHaveLength(47);
    expect(education.find(r => r.code === '13')?.values['elementary:count']).toBe(17193);
    expect(education.find(r => r.code === '13')?.values['junior:count']).toBe(6782);
    expect(sortIssueComparison(education, 'junior:count')[0].code).toBe('13');
    const guidance = issueComparisonRows(data, 'guidance', 2026, 'saitama');
    const kawaguchi = guidance.find(r => r.code === '11203')!;
    expect(kawaguchi.values['elementary:needsForeign']).toBe(1209);
    expect(kawaguchi.values['elementary:receivingForeign']).toBe(981);
  });
  it('sorts numeric values descending, keeps zero, and places missing values last', () => {
    const rows = [{code:'01',name:'a',pref:'',values:{test:null,other:5}}, {code:'02',name:'b',pref:'',values:{test:0,other:2}}, {code:'03',name:'c',pref:'',values:{test:-5,other:1}}];
    expect(sortIssueComparison(rows, 'test').map(r => r.code)).toEqual(['02','03','01']);
    expect(sortIssueComparison(rows, 'other').map(r => r.code)).toEqual(['01','02','03']);
    expect(rows.map(r => r.code)).toEqual(['01','02','03']);
  });
  it('uses readable chart ticks covering zero, positive and negative values', () => {
    expect(issueChartScale([53790], '人')).toEqual({ min: 0, max: 60000, ticks: [0, 20000, 40000, 60000] });
    const change = issueChartScale([-12.5, 38.12], '%');
    expect(change.min).toBeLessThanOrEqual(-12.5);
    expect(change.max).toBeGreaterThanOrEqual(38.12);
    expect(change.ticks).toContain(0);
    expect(issueChartScale([0, 1], '人').ticks).toEqual([0, 1]);
    expect(issueChartScale([], '%').ticks.every(Number.isFinite)).toBe(true);
  });
  it('keeps zero and missing values distinct', () => {
    expect(residentValue(observation(0), undefined, 'count')).toBe(0);
    expect(residentValue(observation(null), undefined, 'count')).toBeNull();
    expect(percent(0, 100)).toBe(0);
    expect(percent(null, 100)).toBeNull();
    expect(percent(20, 0)).toBeNull();
  });
  it('does not invent a growth rate from a zero base or missing prior period', () => {
    expect(residentValue(observation(20), observation(0), 'change1')).toBe(20);
    expect(residentValue(observation(20), observation(0), 'rate1')).toBeNull();
    expect(residentValue(observation(20), undefined, 'rate1')).toBeNull();
    expect(residentValue(observation(10), observation(20), 'rate1')).toBe(-50);
  });
  it('does not impute history for a changed municipality code', () => {
    const missing = residentRows(data, 2026, 'rate10', '').filter(r => r.value === null);
    expect(missing.length).toBeGreaterThan(0);
    expect(residentRows(data, 2016, 'rate10', '').every(r => r.value === null)).toBe(true);
  });
  it('uses weighted prefecture shares and rejects incomplete aggregates', () => {
    const p = data.prefectures.find(p => p.slug === 'saitama')!;
    const records = data.resident.filter(r => r.year === 2026 && data.municipalities.some(m => m.code === r.municipalityCode && m.pref === p.slug));
    expect(prefectureResidentRows(data, 2026, 'ratio').find(r => r.code === p.code)?.value).toBe(
      records.reduce((s,r) => s+r.foreign!,0) / records.reduce((s,r) => s+r.population!,0) * 100);
    const incomplete = { ...data, resident: data.resident.filter(r => !(r.year === 2026 && r.municipalityCode === records[0].municipalityCode)) };
    expect(prefectureResidentRows(incomplete, 2026, 'ratio').find(r => r.code === p.code)?.value).toBeNull();
  });
  it('excludes null values from rankings and retains actual zero', () => {
    expect(issueRank([{code:'1',name:'a',pref:'',value:null},{code:'2',name:'b',pref:'',value:0}]).map(r=>r.code)).toEqual(['2']);
  });
  it('does not treat guidance needs as foreign nationality enrollment', () => {
    expect(educationValue({code:'11',geography:'prefecture',year:2025,stage:'elementary',foreign:10,total:100,sourceIds:[]},'ratio')).toBe(10);
    expect(data.guidance.some(r => r.needsJapanese! > 0)).toBe(true);
    expect(data.education.every(r => r.geography === 'prefecture')).toBe(true);
  });
});

describe('official prototype dataset integrity', () => {
  it('reconciles the latest municipal counts to the official national totals', () => {
    const latest = data.resident.filter(r => r.year === 2026);
    expect(latest.reduce((n,r)=>n+(r.population ?? 0),0)).toBe(123767642);
    expect(latest.reduce((n,r)=>n+(r.foreign ?? 0),0)).toBe(4031159);
    expect(latest.filter(r => r.status === 'out-of-scope')).toHaveLength(6);
  });
  it('has no unknown codes, duplicate observations, or missing source references', () => {
    const codes = new Set(data.municipalities.map(m=>m.code));
    const sourceIds = new Set(data.sources.map(s=>s.id));
    expect(new Set(data.resident.map(r=>`${r.municipalityCode}:${r.year}`)).size).toBe(data.resident.length);
    expect(new Set(data.guidance.map(r=>`${r.code}:${r.stage}`)).size).toBe(data.guidance.length);
    for (const r of data.resident) {
      expect(codes.has(r.municipalityCode)).toBe(true);
      expect(r.sourceIds.every(id=>sourceIds.has(id))).toBe(true);
      if (r.foreign !== null && r.population !== null) expect(r.foreign).toBeLessThanOrEqual(r.population);
    }
    for (const r of data.guidance) expect(codes.has(r.code)).toBe(true);
    expect(data.sources.every(s=>s.sourceUrl.startsWith('https://www.e-stat.go.jp/') && s.sha256?.length === 64)).toBe(true);
  });
  it('covers 47 prefectures for both school types with valid numerators and denominators', () => {
    expect(data.education).toHaveLength(94);
    for (const r of data.education) {
      expect(r.total).toBeGreaterThan(0);
      expect(r.foreign).toBeLessThanOrEqual(r.total!);
    }
  });
  it('joins all in-scope municipality observations to existing map geometry', () => {
    const geometryCodes = new Set<string>();
    for (const p of data.prefectures) {
      const geo = JSON.parse(readFileSync(`public/${p.slug}.geojson`, 'utf8'));
      for (const feature of geo.features) geometryCodes.add(String(feature.properties.code));
    }
    const inScope = data.resident.filter(r => r.year === 2026 && r.status === 'published');
    expect(inScope.filter(r => !geometryCodes.has(r.municipalityCode)).map(r=>r.municipalityCode)).toEqual([]);
  });
});
