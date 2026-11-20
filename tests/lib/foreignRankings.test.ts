import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildForeignRanking, FOREIGN_RANKINGS, foreignRankingPath, rankForeignRows, type ForeignRankingRow } from '@/lib/foreignRankings';
import { type IssuesDataset } from '@/lib/foreignResidentIssues';
import { RANKINGS } from '@/lib/rankings';
import { adPageGroup } from '@/lib/adsensePolicy.mjs';

const data: IssuesDataset = JSON.parse(readFileSync('public/foreign-resident-issues/dataset.json', 'utf8'));
describe('new official-data rankings', () => {
  it('keeps four routes separate from the existing registry while reusing the ad policy', () => {
    expect(new Set(FOREIGN_RANKINGS.map(d => d.slug)).size).toBe(4);
    for (const def of FOREIGN_RANKINGS) {
      expect(RANKINGS.some(r => r.slug === def.slug)).toBe(false);
      expect(adPageGroup(foreignRankingPath(def))).toBe('ranking');
    }
    expect(adPageGroup('/map/foreign-resident-issues')).toBeNull();
  });
  it('uses competition ranks for three ties, keeps zero/negative values and leaves missing unranked', () => {
    const rows = [null, 0, 10, 10, 10, -2].map((value, i) => ({ code: String(i), value, rank: null })) as ForeignRankingRow[];
    const output = rankForeignRows(rows);
    expect(output.map(r => r.rank)).toEqual([1, 1, 1, 4, 5, null]);
    expect(output.map(r => r.value)).toEqual([10, 10, 10, 0, -2, null]);
    expect(rows.every(r => r.rank === null)).toBe(true);
  });
  it('computes yearly growth from same-code, same-date official counts', () => {
    const result = buildForeignRanking(data, FOREIGN_RANKINGS[0]);
    expect(result.year).toBe(2026);
    expect(result.rows).toHaveLength(1741);
    const kawaguchi = result.rows.find(r => r.code === '11203')!;
    const current = data.resident.find(r => r.municipalityCode === '11203' && r.year === 2026)!;
    const before = data.resident.find(r => r.municipalityCode === '11203' && r.year === 2025)!;
    expect(kawaguchi.value).toBe(current.foreign! - before.foreign!);
    expect(kawaguchi.before).toBe(before.foreign);
    expect(kawaguchi.after).toBe(current.foreign);
    const url = new URL(kawaguchi.mapHref, 'https://kurashimap.jp');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ code: '11203', metric: 'change1', year: '2026', pref: 'saitama' });
    expect(result.sources.map(s => s.year).sort()).toEqual([2025, 2025, 2026, 2026]);
  });
  it('does not impute a missing previous code or calculate growth from a zero base', () => {
    const zero = structuredClone(data);
    zero.resident.find(r => r.municipalityCode === '11203' && r.year === 2025)!.foreign = 0;
    expect(buildForeignRanking(zero, FOREIGN_RANKINGS[1]).rows.find(r => r.code === '11203')).toMatchObject({ value: null, rank: null, before: 0 });
    zero.resident = zero.resident.filter(r => !(r.municipalityCode === '11203' && r.year === 2025));
    expect(buildForeignRanking(zero, FOREIGN_RANKINGS[0]).rows.find(r => r.code === '11203')).toMatchObject({ value: null, rank: null, before: null });
  });
  it.each([FOREIGN_RANKINGS[2], FOREIGN_RANKINGS[3]])('keeps $stage school populations at prefecture level', def => {
    const result = buildForeignRanking(data, def);
    expect(result.year).toBe(2025);
    expect(result.rows).toHaveLength(47);
    expect(result.eligibleCount).toBe(47);
    const row = result.rows.find(r => r.code === '11')!;
    const observation = data.education.find(r => r.code === '11' && r.stage === def.stage && r.year === result.year)!;
    expect(row.value).toBe(observation.foreign! / observation.total! * 100);
    expect(row.before).toBe(observation.total);
    expect(row.after).toBe(observation.foreign);
    expect(new URL(row.mapHref, 'https://kurashimap.jp').searchParams.get('stage')).toBe(def.stage);
    expect(result.sources.every(s => s.id.startsWith(`school-${def.stage}-`))).toBe(true);
  });
});
