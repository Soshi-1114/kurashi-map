import { vi } from 'vitest';
import { issueChunks } from '@/scripts/_lib/foreign-issue-chunks.mjs';
import type { IssuesDataset } from '@/lib/foreignResidentIssues';

export function issueFetchFixture(data: IssuesDataset) {
  const { manifest, chunks } = issueChunks(data);
  const files = new Map<string, unknown>([['/foreign-resident-issues/manifest.json', manifest], ...chunks.map((c: { relative: string; records: unknown }) => [`/foreign-resident-issues/${c.relative}`, c.records] as [string, unknown])]);
  return vi.fn(async (url: string) => ({ ok: files.has(url), json: async () => files.get(url) }));
}
