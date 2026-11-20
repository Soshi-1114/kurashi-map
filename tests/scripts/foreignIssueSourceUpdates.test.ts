import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { inspectSources, residentCatalogUrl, semanticDataset } from '@/scripts/_lib/foreign-source-catalog.mjs';

const config = JSON.parse(readFileSync('scripts/config/foreign-resident-issues.json', 'utf8'));
const original = JSON.parse(readFileSync('public/foreign-resident-issues/dataset.json', 'utf8'));
function fixture() {
  const cfg = { ...config, resident: { startYear: 2026, endYear: 2026 }, education: { ...config.education, history: [] } };
  const sources = original.sources.filter((s: { id: string }) => s.id.endsWith('2026') || s.id.startsWith('school-') && s.id.endsWith('2025'));
  const bodies = new Map<string, Buffer>();
  const copies = sources.map((s: { id: string; downloadUrl: string }) => {
    const bytes = Buffer.from(s.id); bodies.set(s.downloadUrl, bytes);
    return { ...s, sha256: createHash('sha256').update(bytes).digest('hex') };
  });
  const article = (id: string, label: string) => {
    const source = copies.find((s: { id: string }) => s.id === id)!;
    return `<article>${label} 調査年月 ${source.year}年 公開（更新）日 ${source.sourcePublishedAt}<a href="file-download?statInfId=${new URL(source.downloadUrl).searchParams.get('statInfId')}&fileKind=0">EXCEL</a></article>`;
  };
  bodies.set(residentCatalogUrl(2026), Buffer.from(article('juki-total-2026', '【総計】市区町村別人口、人口動態及び世帯数') + article('juki-foreign-2026', '【外国人住民】市区町村別人口、人口動態及び世帯数')));
  for (const table of cfg.education.tables) bodies.set(table.listUrl, Buffer.from(article(`school-${table.stage}-foreign-2025`, table.foreignLabel) + article(`school-${table.stage}-total-2025`, table.totalLabel)));
  return { data: { ...original, sources: copies }, config: cfg, bodies, fetch: async (url: string) => {
    const b = bodies.get(url); if (!b) throw new Error('Unexpected fixture URL'); return b;
  } };
}
describe('official source revision detection', () => {
  it('does not produce changes from a matching catalogue/hash or regenerated timestamps', async () => {
    const f = fixture(); expect(await inspectSources(f.data, f.config, f.fetch, 2025)).toEqual({ changed: [], candidates: [], requiresManualReview: false });
    expect(semanticDataset({ ...original, generatedAt: '2099-01-01', sources: original.sources.map((s: object) => ({ ...s, updatedAt: '2099-01-01' })) })).toBe(semanticDataset(original));
  });
  it('detects revised bytes and flags a changed curated municipal PDF for manual review', async () => {
    const f = fixture(); const source = f.data.sources.find((s: { id: string }) => s.id.startsWith('local-'))!;
    f.bodies.set(source.downloadUrl, Buffer.from('changed publication'));
    const result = await inspectSources(f.data, f.config, f.fetch, 2025);
    expect(result.requiresManualReview).toBe(true);
    expect(result.changed).toEqual([expect.objectContaining({ id: source.id, reason: 'content', manualReview: true })]);
  });
  it('detects a changed catalogue table ID without fetching the outdated file', async () => {
    const f = fixture(); const url = residentCatalogUrl(2026);
    const source = f.data.sources.find((s: { id: string }) => s.id === 'juki-foreign-2026')!;
    const oldId = new URL(source.downloadUrl).searchParams.get('statInfId')!;
    f.bodies.set(url, Buffer.from(f.bodies.get(url)!.toString().replace(oldId, '000000000001')));
    f.bodies.delete(source.downloadUrl);
    expect((await inspectSources(f.data, f.config, f.fetch, 2025)).changed).toContainEqual(expect.objectContaining({ id: source.id, reason: 'catalogue', statInfId: '000000000001' }));
  });
  it('rejects a source outage rather than interpreting it as no change', async () => {
    const f = fixture(); await expect(inspectSources(f.data, f.config, async () => { throw new Error('offline'); }, 2025)).rejects.toThrow('offline');
  });
});
