import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ForeignIssueClient, type IssueManifest } from '@/lib/foreignIssueClient';
import { issueChunks } from '@/scripts/_lib/foreign-issue-chunks.mjs';
import { issueFetchFixture } from '@/tests/helpers/foreignIssueFixture';
import type { IssuesDataset } from '@/lib/foreignResidentIssues';
const data: IssuesDataset = JSON.parse(readFileSync('public/foreign-resident-issues/dataset.json', 'utf8'));

describe('versioned, lazy statistical data', () => {
  it('loads only required resident years and keeps school/guidance/history out of the initial request', async () => {
    const fetcher = issueFetchFixture(data); const client = new ForeignIssueClient(fetcher);
    const m = await client.manifest(); const result = await client.load(m, 'residents', 2026, []);
    expect([...new Set(result.resident.map(r => r.year))].sort()).toEqual([2016, 2021, 2025, 2026]);
    expect(result.education).toEqual([]); expect(result.guidance).toEqual([]);
    expect(fetcher.mock.calls).toHaveLength(5);
    expect(fetcher.mock.calls.some(([url]) => url.includes('dataset.json') || url.includes('residentHistory'))).toBe(false);
    const total = Buffer.byteLength(JSON.stringify(m)) + [2026, 2025, 2021, 2016].reduce((n, y) => n + m.files.residents[y].bytes, 0);
    expect(total).toBeLessThan(Buffer.byteLength(JSON.stringify(data)) * 0.4);
  });
  it('fetches selected municipality history by prefecture once and deduplicates overlapping observations', async () => {
    const fetcher = issueFetchFixture(data); const client = new ForeignIssueClient(fetcher); const m = await client.manifest();
    await client.load(m, 'residents', 2026, []);
    const result = await client.load(m, 'residents', 2026, ['11203', '11201']);
    expect(fetcher.mock.calls.filter(([url]) => url.includes('residentHistory'))).toHaveLength(1);
    expect(result.resident.filter(r => r.municipalityCode === '11203')).toHaveLength(11);
    expect(new Set(result.resident.map(r => `${r.municipalityCode}:${r.year}`)).size).toBe(result.resident.length);
    await client.load(m, 'residents', 2026, ['11203']); expect(fetcher.mock.calls).toHaveLength(6);
  });
  it('loads education history only after selection and keeps Japanese guidance in its own series', async () => {
    const fetcher = issueFetchFixture(data); const client = new ForeignIssueClient(fetcher); const m = await client.manifest();
    expect((await client.load(m, 'education', 2025, [])).education).toHaveLength(94);
    expect((await client.load(m, 'education', 2025, ['23'])).education).toHaveLength(282);
    expect((await client.load(m, 'guidance', 2025, ['11203'])).guidance).toHaveLength(3482);
    expect(fetcher.mock.calls.some(([url]) => url.includes('/residents/') || url.includes('residentHistory'))).toBe(false);
    await expect(client.load(m, 'education', 2099, [])).rejects.toThrow('未収録');
  });
  it('retries failed requests without returning a zero-filled dataset', async () => {
    const fetcher = issueFetchFixture(data); const client = new ForeignIssueClient(fetcher); const m = await client.manifest();
    fetcher.mockRejectedValueOnce(new Error('offline'));
    await expect(client.load(m, 'education', 2025, [])).rejects.toThrow('offline');
    expect((await client.load(m, 'education', 2025, [])).education).toHaveLength(94);
  });
  it('publishes matching content hashes, row counts and all shipped manifest files', () => {
    const { manifest, chunks } = issueChunks(data);
    for (const c of chunks) {
      const json = JSON.stringify(c.records); const hash = createHash('sha256').update(json).digest('hex');
      expect(c.relative).toContain(hash.slice(0, 16));
      expect(JSON.parse(readFileSync(`public/foreign-resident-issues/${c.relative}`, 'utf8'))).toEqual(c.records);
    }
    const published: IssueManifest = JSON.parse(readFileSync('public/foreign-resident-issues/manifest.json', 'utf8'));
    expect(published).toEqual(manifest);
    expect(manifest.localEducation).toHaveLength(2);
  });
});
