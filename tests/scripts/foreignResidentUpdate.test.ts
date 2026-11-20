import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { updateOptions, validateUpdateConfig, fiscalYearLabel, validateIssueDataset, writeDatasetAtomically } from '@/scripts/_lib/foreign-resident-update.mjs';
import { NORTHERN_TERRITORIES_CODES } from '@/scripts/_lib/prefs.mjs';

const config = JSON.parse(readFileSync('scripts/config/foreign-resident-issues.json', 'utf8'));
const dataset = JSON.parse(readFileSync('public/foreign-resident-issues/dataset.json', 'utf8'));
const temporary: string[] = [];
afterEach(async () => { for (const folder of temporary.splice(0)) await rm(folder, { recursive: true, force: true }); });

describe('official data update options and safeguards', () => {
  it('uses the OS temporary directory and explicit output/check options', () => {
    expect(updateOptions([], process.cwd()).cache).toBe(path.join(os.tmpdir(), 'kurashi-foreign-resident-sources'));
    const options = updateOptions(['--cache-dir', '/tmp/official-cache', '--output', '/tmp/test-dataset.json', '--refresh', '--check'], process.cwd());
    expect(options).toMatchObject({ cache: '/tmp/official-cache', output: '/tmp/test-dataset.json', refresh: true, download: true, check: true });
    expect(() => updateOptions(['--cache-dir'], process.cwd())).toThrow('Missing value');
    expect(() => updateOptions(['--unknown'], process.cwd())).toThrow('Unknown option');
    expect(() => updateOptions(['--check', '--check'], process.cwd())).toThrow('Duplicate option');
    expect(() => updateOptions(['--output', 'dataset.txt'], process.cwd())).toThrow('JSON file');
  });
  it('validates the explicit source manifest without guessing future table URLs', () => {
    expect(validateUpdateConfig(config)).toBe(config);
    expect(() => validateUpdateConfig({ ...config, resident: { startYear: 2027, endYear: 2026 } })).toThrow('year range');
    expect(() => validateUpdateConfig({ ...config, education: { ...config.education, tables: [config.education.tables[0], config.education.tables[0]] } })).toThrow('school stages');
    expect(() => validateUpdateConfig({ ...config, education: { ...config.education, tables: config.education.tables.map((t: object) => ({ ...t, listUrl: 'https://example.com/table' })) } })).toThrow('official school table');
    expect(fiscalYearLabel(2019)).toBe('令和元年度');
    expect(fiscalYearLabel(2025)).toBe('令和7年度');
    expect(fiscalYearLabel(2026)).toBe('令和8年度');
  });
  it('accepts the shipped official dataset, but rejects duplicate, missing and mixed-year data', () => {
    expect(() => validateIssueDataset(dataset, config, NORTHERN_TERRITORIES_CODES)).not.toThrow();
    const cases = [
      (d: typeof dataset) => d.guidance.push(d.guidance[0]),
      (d: typeof dataset) => d.guidance.pop(),
      (d: typeof dataset) => { d.education[0].year++; },
      (d: typeof dataset) => { d.guidance[0].code = '99999'; },
      (d: typeof dataset) => { d.education[0].foreign = d.education[0].total + 1; },
      (d: typeof dataset) => { d.resident[0].population = -1; },
      (d: typeof dataset) => { delete d.education[0].total; },
      (d: typeof dataset) => { d.resident[0].sourceIds = ['unknown']; },
      (d: typeof dataset) => { d.localEducation[0].sourceIds = []; },
    ];
    for (const mutate of cases) {
      const broken = structuredClone(dataset); mutate(broken);
      expect(() => validateIssueDataset(broken, config, NORTHERN_TERRITORIES_CODES)).toThrow();
    }
  });
  it('replaces output atomically and preserves the previous file if serialization fails', async () => {
    const folder = await mkdtemp(path.join(os.tmpdir(), 'foreign-update-test-')); temporary.push(folder);
    const output = path.join(folder, 'dataset.json');
    await writeFile(output, 'previous');
    const circular: { self?: object } = {}; circular.self = circular;
    await expect(writeDatasetAtomically(output, circular)).rejects.toThrow();
    expect(await readFile(output, 'utf8')).toBe('previous');
    await writeDatasetAtomically(output, { version: 2 });
    expect(JSON.parse(await readFile(output, 'utf8'))).toEqual({ version: 2 });
    expect(await readdir(folder)).toEqual(['dataset.json']);
  });
});
