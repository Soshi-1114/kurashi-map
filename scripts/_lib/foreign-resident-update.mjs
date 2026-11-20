import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';

export function updateOptions(argv, root) {
  const options = { config: path.join(root, 'scripts/config/foreign-resident-issues.json'),
    cache: path.join(os.tmpdir(), 'kurashi-foreign-resident-sources'),
    output: path.join(root, 'public/foreign-resident-issues/dataset.json'), download: false, refresh: false, check: false };
  const paths = { '--config': 'config', '--cache-dir': 'cache', '--output': 'output' };
  const seen = new Set();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (seen.has(arg)) throw new Error(`Duplicate option: ${arg}`);
    seen.add(arg);
    if (arg === '--download' || arg === '--refresh' || arg === '--check') options[arg.slice(2)] = true;
    else if (paths[arg]) {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw new Error(`Missing value: ${arg}`);
      options[paths[arg]] = path.resolve(value);
    } else throw new Error(`Unknown option: ${arg}`);
  }
  if (options.refresh) options.download = true;
  if (path.extname(options.output) !== '.json') throw new Error('--output must be a JSON file');
  return options;
}

export function validateUpdateConfig(config) {
  const year = y => Number.isInteger(y) && y >= 1989 && y <= 2100;
  if (!year(config.resident?.startYear) || !year(config.resident?.endYear) || config.resident.startYear > config.resident.endYear) throw new Error('Invalid resident year range');
  if (!year(config.education?.year) || !year(config.guidance?.year)) throw new Error('Invalid school/guidance year');
  const schools = [...(config.education.history ?? []), config.education];
  if (new Set(schools.map(s => s.year)).size !== schools.length || schools.some(s => !year(s.year) || s.year > config.education.year)) throw new Error('Invalid school history years');
  for (const school of schools) {
  const tables = school.tables;
  if (!Array.isArray(tables) || tables.length !== 2 || ['elementary', 'junior'].some(stage => tables.filter(t => t.stage === stage).length !== 1)) throw new Error('Both school stages are required exactly once');
  for (const table of tables) {
    const url = new URL(table.listUrl);
    if (url.origin !== 'https://www.e-stat.go.jp' || url.pathname !== '/stat-search/files' || !table.foreignLabel || !table.totalLabel) throw new Error('Invalid official school table');
  }
  }
  if (!/^\d{12}$/.test(config.guidance.statInfId) || !/^\d{4}-\d{2}-\d{2}$/.test(config.guidance.publishedAt)
    || new Date(config.guidance.publishedAt).toISOString().slice(0, 10) !== config.guidance.publishedAt) throw new Error('Invalid guidance source metadata');
  return config;
}

export function fiscalYearLabel(year) {
  const start = year >= 2019 ? 2018 : 1988;
  return `${year >= 2019 ? '令和' : '平成'}${year - start === 1 ? '元' : year - start}年度`;
}

/** Validate before touching a published dataset, including on --check. */
export function validateIssueDataset(data, config, outside) {
  const codes = new Set(data.municipalities.map(m => m.code));
  const sourceIds = new Set(data.sources.map(s => s.id));
  if (codes.size !== data.municipalities.length || sourceIds.size !== data.sources.length) throw new Error('Duplicate municipality/source');
  for (const [key, records, id] of [
    ['resident', data.resident, r => `${r.municipalityCode}:${r.year}`],
    ['education', data.education, r => `${r.code}:${r.year}:${r.stage}`],
    ['guidance', data.guidance, r => `${r.code}:${r.year}:${r.stage}`],
  ]) {
    if (new Set(records.map(id)).size !== records.length) throw new Error(`Duplicate ${key} observation`);
    for (const r of records) {
      if (!r.sourceIds.length || r.sourceIds.some(id => !sourceIds.has(id))) throw new Error(`Missing ${key} source reference`);
      const required = key === 'resident' ? ['population', 'foreign'] : key === 'education' ? ['foreign', 'total'] : ['needsForeign', 'needsJapanese', 'receivingForeign'];
      if (required.some(metric => r[metric] === undefined)) throw new Error(`Missing ${key} count`);
      for (const metric of ['population', 'foreign', 'total', 'needsForeign', 'needsJapanese', 'receivingForeign']) {
        if (r[metric] !== undefined && r[metric] !== null && (!Number.isSafeInteger(r[metric]) || r[metric] < 0)) throw new Error(`Invalid ${key} count`);
      }
      if (key !== 'education' && !codes.has(r.municipalityCode ?? r.code)) throw new Error(`Unknown ${key} municipality`);
    }
  }
  const years = config.resident.endYear - config.resident.startYear + 1;
  if (data.resident.length !== codes.size * years || data.education.length !== data.prefectures.length * 2 * (1 + (config.education.history?.length ?? 0)) || data.guidance.length !== [...codes].filter(c => !outside.has(c)).length * 2) throw new Error('Observation coverage mismatch');
  const prefCodes = new Set(data.prefectures.map(p => p.code));
  for (const r of data.resident) if (!Number.isInteger(r.year) || r.year < config.resident.startYear || r.year > config.resident.endYear || (r.foreign !== null && r.population !== null && r.foreign > r.population)) throw new Error('Resident year/count mismatch');
  for (const r of data.education) if (![config.education.year, ...(config.education.history ?? []).map(s => s.year)].includes(r.year) || !['elementary', 'junior'].includes(r.stage) || !prefCodes.has(r.code) || (r.foreign !== null && r.total !== null && r.foreign > r.total)) throw new Error('School year/code/count mismatch');
  for (const r of data.guidance) if (r.year !== config.guidance.year || !['elementary', 'junior'].includes(r.stage) || outside.has(r.code) || (r.receivingForeign !== null && r.needsForeign !== null && r.receivingForeign > r.needsForeign)) throw new Error('Guidance year/code/count mismatch');
  const local = data.localEducation ?? [];
  if (new Set(local.map(r => `${r.municipalityCode}:${r.year}:${r.stage}`)).size !== local.length) throw new Error('Duplicate local education observation');
  for (const r of local) if (!codes.has(r.municipalityCode) || r.coverage !== 'municipal-public' || r.total !== null
    || !['elementary', 'junior'].includes(r.stage) || !Number.isSafeInteger(r.foreign) || r.foreign < 0 || !r.asOf.startsWith(`${r.year}-`) || !r.sourceIds.length || r.sourceIds.some(id => !sourceIds.has(id))) throw new Error('Invalid scoped local education observation');
}

export async function writeDatasetAtomically(filename, data) {
  await fs.mkdir(path.dirname(filename), { recursive: true });
  const temporary = `${filename}.${process.pid}.${Date.now()}.tmp`;
  try { await fs.writeFile(temporary, JSON.stringify(data)); await fs.rename(temporary, filename); }
  finally { await fs.rm(temporary, { force: true }); }
}
