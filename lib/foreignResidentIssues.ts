/** Dedicated data contract. Existing Municipality/Metric contracts are unchanged. */
export type IssueSource = {
  id: string; sourceName: string; sourceUrl: string; downloadUrl?: string;
  year: number; period: string; sourcePublishedAt: string | null; updatedAt: string;
  definition: string; licenseUrl?: string; sha256?: string;
};
export type IssueMunicipality = { code: string; name: string; pref: string };
export type ResidentObservation = {
  municipalityCode: string; year: number; population: number | null; foreign: number | null;
  sourceIds: string[]; status: string;
};
export type EducationObservation = {
  code: string; geography: 'prefecture' | 'municipality'; year: number;
  stage: 'elementary' | 'junior' | 'combined'; foreign: number | null; total: number | null;
  publishedRatio?: number; sourceIds: string[];
};
export type IssuesDataset = {
  schemaVersion: number; generatedAt: string; municipalities: IssueMunicipality[];
  prefectures: { code: string; slug: string; name: string }[];
  resident: ResidentObservation[]; education: EducationObservation[]; guidance: GuidanceObservation[]; sources: IssueSource[];
};
export type GuidanceObservation = { code: string; year: number; stage: 'elementary' | 'junior';
  needsForeign: number | null; needsJapanese: number | null; receivingForeign: number | null; support: string[]; sourceIds: string[] };
export const RESIDENT_METRICS = {
  count: { label: '外国人住民数', unit: '人' },
  ratio: { label: '人口に占める割合', unit: '%' },
  change1: { label: '前年比増減数', unit: '人' },
  rate1: { label: '前年比増減率', unit: '%' },
  change5: { label: '5年間の増減数', unit: '人' },
  rate5: { label: '5年間の増減率', unit: '%' },
  change10: { label: '10年間の増減数', unit: '人' },
  rate10: { label: '10年間の増減率', unit: '%' },
} as const;
export type ResidentMetric = keyof typeof RESIDENT_METRICS;
export type IssueMapRow = { code: string; name: string; pref: string; value: number | null };
export type IssueTheme = 'residents' | 'education' | 'guidance';
/** Only years actually present in each statistical series can be selected. */
export function issueYears(data: IssuesDataset, theme: IssueTheme): number[] {
  const rows = theme === 'residents' ? data.resident : theme === 'education' ? data.education : data.guidance;
  return [...new Set(rows.map(r => r.year))].sort((a, b) => a - b);
}
export type IssueComparisonColumn = { key: string; label: string; unit: string };
export type IssueComparisonRow = { code: string; name: string; pref: string; values: Record<string, number | null> };

export function issueComparisonColumns(theme: IssueTheme): IssueComparisonColumn[] {
  if (theme === 'residents') return Object.entries(RESIDENT_METRICS).map(([key, m]) => ({ key, ...m }));
  return (['elementary', 'junior'] as const).flatMap(stage => {
    const school = stage === 'elementary' ? '小学校' : '中学校';
    const pupil = stage === 'elementary' ? '児童' : '生徒';
    if (theme === 'education') return [
      { key: `${stage}:count`, label: `外国籍${pupil}数（${school}）`, unit: '人' },
      { key: `${stage}:ratio`, label: `外国籍${pupil}割合（${school}）`, unit: '%' },
    ];
    return [
      { key: `${stage}:needsForeign`, label: `必要人数（外国籍・${school}）`, unit: '人' },
      { key: `${stage}:needsJapanese`, label: `必要人数（日本国籍・${school}）`, unit: '人' },
      { key: `${stage}:receivingForeign`, label: `指導実施人数（外国籍・${school}）`, unit: '人' },
    ];
  });
}

/** Keep differing statistical populations in their own theme and geography. */
export function issueComparisonRows(data: IssuesDataset, theme: IssueTheme, year: number, pref: string): IssueComparisonRow[] {
  const columns = issueComparisonColumns(theme);
  const residents = new Map(data.resident.map(r => [`${r.municipalityCode}:${r.year}`, r]));
  const education = new Map(data.education.filter(r => r.year === year).map(r => [`${r.code}:${r.stage}`, r]));
  const guidance = new Map(data.guidance.filter(r => r.year === year).map(r => [`${r.code}:${r.stage}`, r]));
  const regions = theme === 'education' ? data.prefectures.map(p => ({ code: p.code, name: p.name, pref: p.slug }))
    : data.municipalities.filter(m => !pref || m.pref === pref);
  return regions.map(region => ({ ...region, values: Object.fromEntries(columns.map(column => {
    if (theme === 'residents') {
      const metric = column.key as ResidentMetric;
      return [column.key, residentValue(residents.get(`${region.code}:${year}`), residents.get(`${region.code}:${year - metricLag(metric)}`), metric)];
    }
    const [stage, metric] = column.key.split(':');
    return [column.key, theme === 'education'
      ? educationValue(education.get(`${region.code}:${stage}`), metric as 'count' | 'ratio')
      : guidance.get(`${region.code}:${stage}`)?.[metric as 'needsForeign' | 'needsJapanese' | 'receivingForeign'] ?? null];
  })) }));
}

export function sortIssueComparison(rows: IssueComparisonRow[], key: string): IssueComparisonRow[] {
  return [...rows].sort((a, b) => {
    const av = a.values[key] ?? null, bv = b.values[key] ?? null;
    if (av === null || bv === null) return av === bv ? a.code.localeCompare(b.code) : av === null ? 1 : -1;
    return bv - av || a.code.localeCompare(b.code);
  });
}

export function percent(n: number | null, d: number | null): number | null {
  return n !== null && d !== null && d > 0 ? n / d * 100 : null;
}
export function residentValue(current: ResidentObservation | undefined, previous: ResidentObservation | undefined, metric: ResidentMetric): number | null {
  if (!current) return null;
  if (metric === 'count') return current.foreign;
  if (metric === 'ratio') return percent(current.foreign, current.population);
  if (current.foreign === null || previous?.foreign == null || current.population === null || previous.population === null) return null;
  const change = current.foreign - previous.foreign;
  return metric.startsWith('rate') ? percent(change, previous.foreign) : change;
}
export function metricLag(metric: ResidentMetric): number {
  return metric.endsWith('10') ? 10 : metric.endsWith('5') ? 5 : 1;
}
export function educationValue(row: EducationObservation | undefined, metric: 'count' | 'ratio'): number | null {
  if (!row) return null;
  return metric === 'count' ? row.foreign : row.publishedRatio ?? percent(row.foreign, row.total);
}
/** No interpolation across a municipality that did not exist under the same code. */
export function residentRows(data: IssuesDataset, year: number, metric: ResidentMetric, pref: string): IssueMapRow[] {
  const byKey = new Map(data.resident.map(r => [`${r.municipalityCode}:${r.year}`, r]));
  return data.municipalities.filter(m => !pref || m.pref === pref).map(m => ({ ...m,
    value: residentValue(byKey.get(`${m.code}:${year}`), byKey.get(`${m.code}:${year - metricLag(metric)}`), metric),
  }));
}
/** A prefecture is missing if any constituent municipality is missing. */
export function prefectureResidentRows(data: IssuesDataset, year: number, metric: ResidentMetric): IssueMapRow[] {
  const byKey = new Map(data.resident.map(r => [`${r.municipalityCode}:${r.year}`, r]));
  return data.prefectures.map(p => {
    const members = data.municipalities.filter(m => m.pref === p.slug && byKey.get(`${m.code}:${year}`)?.status !== 'out-of-scope');
    function sum(y: number): ResidentObservation {
      const rows = members.map(m => byKey.get(`${m.code}:${y}`));
      const complete = rows.every(r => r && r.population !== null && r.foreign !== null);
      return { municipalityCode: p.code, year: y, population: complete ? rows.reduce((s, r) => s + r!.population!, 0) : null,
        foreign: complete ? rows.reduce((s, r) => s + r!.foreign!, 0) : null, sourceIds: [], status: complete ? 'published' : 'unavailable' };
    }
    return { code: p.code, name: p.name, pref: p.slug, value: residentValue(sum(year), sum(year - metricLag(metric)), metric) };
  });
}
export function formatIssueValue(value: number | null, unit = '人'): string {
  if (value === null || !Number.isFinite(value)) return 'データなし';
  return `${value.toLocaleString('ja-JP', { maximumFractionDigits: unit === '%' ? 2 : 0 })}${unit}`;
}
export function issueRank(rows: IssueMapRow[]): IssueMapRow[] {
  return rows.filter(r => r.value !== null).sort((a, b) => b.value! - a.value! || a.code.localeCompare(b.code));
}

/** Readable, zero-inclusive ticks; count axes never imply fractional people. */
export function issueChartScale(values: number[], unit: string) {
  const low = Math.min(0, ...values), high = Math.max(0, ...values);
  const rough = (high - low || 1) / 3;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = Math.max(unit === '人' ? 1 : 0.01,
    [1, 2, 5, 10].find(n => n * magnitude >= rough)! * magnitude);
  const min = Math.floor(low / step) * step;
  const max = Math.max(min + step, Math.ceil(high / step) * step);
  const ticks = Array.from({ length: Math.round((max - min) / step) + 1 }, (_, i) => Number((min + i * step).toPrecision(12)));
  return { min, max, ticks };
}
