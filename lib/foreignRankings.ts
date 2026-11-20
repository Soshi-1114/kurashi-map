import { educationValue, residentValue, type IssuesDataset } from './foreignResidentIssues';

/** Independent of the existing Municipality-based ranking registry. */
export const FOREIGN_RANKINGS = [
  { slug: 'foreign-resident-growth', title: '外国人住民の前年比増加数ランキング', label: '外国人住民の増加数', theme: 'residents', metric: 'change1', unit: '人', geography: 'municipality',
    description: '住民基本台帳の外国人住民数を同じ自治体コード・前年同日で比較。増加数と前年・当年の人数を確認できます。' },
  { slug: 'foreign-resident-growth-rate', title: '外国人住民の前年比増加率ランキング', label: '外国人住民の増加率', theme: 'residents', metric: 'rate1', unit: '%', geography: 'municipality',
    description: '住民基本台帳の外国人住民数の前年比増減率を市区町村別に比較。前年人数と当年人数を併記します。' },
  { slug: 'foreign-student-elementary-ratio', title: '小学校の外国籍児童割合ランキング', label: '小学校の外国籍児童割合', theme: 'education', stage: 'elementary', unit: '%', geography: 'prefecture',
    description: '学校基本調査をもとに、国公私立の小学校に在籍する外国籍児童の割合を47都道府県で比較します。' },
  { slug: 'foreign-student-junior-ratio', title: '中学校の外国籍生徒割合ランキング', label: '中学校の外国籍生徒割合', theme: 'education', stage: 'junior', unit: '%', geography: 'prefecture',
    description: '学校基本調査をもとに、国公私立の中学校に在籍する外国籍生徒の割合を47都道府県で比較します。' },
] as const;
export type ForeignRankingDef = typeof FOREIGN_RANKINGS[number];
export type ForeignRankingSlug = ForeignRankingDef['slug'];
export type ForeignRankingRow = {
  code: string; name: string; pref: string; prefName: string; value: number | null;
  before: number | null; after: number | null; rank: number | null; mapHref: string;
};

export function foreignRankingPath(def: ForeignRankingDef): string { return `/ranking/${def.slug}`; }
export function foreignRankingYear(data: IssuesDataset, def: ForeignRankingDef): number {
  const years = def.theme === 'residents' ? data.resident.map(r => r.year)
    : data.education.filter(r => r.stage === def.stage && r.geography === 'prefecture').map(r => r.year);
  if (!years.length) throw new Error(`No official data for ${def.slug}`);
  return Math.max(...years);
}

/** Competition ranks use unrounded values; a code only breaks display-order ties. */
export function rankForeignRows(rows: ForeignRankingRow[]): ForeignRankingRow[] {
  const sorted = [...rows].sort((a, b) => a.value === null || b.value === null
    ? a.value === b.value ? a.code.localeCompare(b.code) : a.value === null ? 1 : -1
    : b.value - a.value || a.code.localeCompare(b.code));
  let rank = 0;
  return sorted.map((row, i) => {
    if (i === 0 || row.value !== sorted[i - 1].value) rank = i + 1;
    return { ...row, rank: row.value === null ? null : rank };
  });
}

export function buildForeignRanking(data: IssuesDataset, def: ForeignRankingDef) {
  const year = foreignRankingYear(data, def);
  const sourceIds = new Set<string>();
  const prefectures = new Map(data.prefectures.map(p => [p.slug, p.name]));
  const residents = new Map(data.resident.map(r => [`${r.municipalityCode}:${r.year}`, r]));
  const education = new Map(data.education.filter(r => r.year === year && r.geography === 'prefecture').map(r => [`${r.code}:${r.stage}`, r]));
  const regions = def.theme === 'residents'
    ? data.municipalities.filter(m => residents.get(`${m.code}:${year}`)?.status !== 'out-of-scope')
    : data.prefectures.map(p => ({ code: p.code, name: p.name, pref: p.slug }));
  const rows = regions.map(region => {
    const params = new URLSearchParams({ tab: def.theme, year: String(year), code: region.code });
    let before: number | null; let after: number | null; let value: number | null;
    if (def.theme === 'residents') {
      const current = residents.get(`${region.code}:${year}`);
      const previous = residents.get(`${region.code}:${year - 1}`);
      before = previous?.foreign ?? null; after = current?.foreign ?? null;
      value = residentValue(current, previous, def.metric);
      [...current?.sourceIds ?? [], ...previous?.sourceIds ?? []].forEach(id => sourceIds.add(id));
      params.set('metric', def.metric); params.set('pref', region.pref);
    } else {
      const observation = education.get(`${region.code}:${def.stage}`);
      before = observation?.total ?? null; after = observation?.foreign ?? null;
      value = educationValue(observation, 'ratio');
      observation?.sourceIds.forEach(id => sourceIds.add(id));
      params.set('stage', def.stage); params.set('educationMetric', 'ratio');
    }
    return { ...region, prefName: prefectures.get(region.pref) ?? region.pref, before, after, value,
      rank: null, mapHref: `/map/foreign-resident-issues?${params}` };
  });
  const ranked = rankForeignRows(rows);
  return { year, rows: ranked, eligibleCount: ranked.filter(r => r.value !== null).length,
    sources: data.sources.filter(s => sourceIds.has(s.id)) };
}
