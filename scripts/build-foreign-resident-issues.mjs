// Independent data pipeline. Never writes existing municipality JSONs.
// Usage: node scripts/build-foreign-resident-issues.mjs [--download|--refresh] [--check]
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import XLSX from 'xlsx';
import { execFileSync } from 'node:child_process';
import { PREFS, NORTHERN_TERRITORIES_CODES } from './_lib/prefs.mjs';
import { updateOptions, validateUpdateConfig, fiscalYearLabel, validateIssueDataset, writeDatasetAtomically } from './_lib/foreign-resident-update.mjs';
import { writeIssueChunks } from './_lib/foreign-issue-chunks.mjs';

const root = path.resolve(import.meta.dirname, '..');
const options = updateOptions(process.argv.slice(2), root);
const config = validateUpdateConfig(JSON.parse(await fs.readFile(options.config, 'utf8')));
const { cache, output, download, refresh, check } = options;
await fs.mkdir(cache, { recursive: true });
const sources = [];
async function retrieve(url, filename) {
  const file = path.join(cache, filename);
  if (!refresh) {
    try { return await fs.readFile(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  if (!download) throw new Error(`Missing ${file}; run with --download or set --cache-dir`);
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(file, bytes);
  return bytes;
}
function articles(html) {
  return [...html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/g)].map(m => {
    const body = m[1];
    return { text: body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '),
      id: body.match(/file-download\?statInfId=(\d+)&(?:amp;)?fileKind=0/)?.[1],
      publishedAt: body.match(/公開（更新）日[\s\S]*?(\d{4}-\d{2}-\d{2})/)?.[1] };
  }).filter(x => x.id);
}
function rows(bytes) {
  const wb = XLSX.read(bytes, { type: 'buffer' });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null });
}
async function table(article, id, name, year, period, definition) {
  if (!article) throw new Error(`Missing official table: ${id}`);
  const url = `https://www.e-stat.go.jp/stat-search/file-download?statInfId=${article.id}&fileKind=0`;
  const bytes = await retrieve(url, `${id}.xlsx`);
  const source = { id, sourceName: name, sourceUrl: `https://www.e-stat.go.jp/stat-search/files?layout=dataset&stat_infid=${article.id}`,
    downloadUrl: url, year, period, sourcePublishedAt: article.publishedAt ?? null,
    updatedAt: new Date().toISOString().slice(0, 10), sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    definition, licenseUrl: 'https://www.e-stat.go.jp/terms-of-use' };
  sources.push(source);
  return { rows: rows(bytes), sourceId: id };
}
const municipalities = [];
const prefectures = [];
for (const [slug, pref] of Object.entries(PREFS)) {
  const list = JSON.parse(await fs.readFile(path.join(root, `data/${slug}.json`), 'utf8'));
  municipalities.push(...list.filter(m => (m.level ?? 'muni') === 'muni').map(m => ({ code: m.code, name: m.name, pref: slug })));
  prefectures.push({ code: pref.code, slug, name: pref.nameJa ?? pref.name });
}
const known = new Set(municipalities.map(m => m.code));
const resident = [];
for (let year = config.resident.startYear; year <= config.resident.endYear; year++) {
  const url = `https://www.e-stat.go.jp/stat-search/files?cycle=7&layout=datalist&month=0&page=1&tclass1=000001039601&toukei=00200241&tstat=000001039591&year=${year}0`;
  const list = articles((await retrieve(url, `juki-${year}.html`)).toString());
  const maps = {};
  const sourceIds = {};
  for (const [kind, label] of [['total', '総計'], ['foreign', '外国人住民']]) {
    const item = list.find(a => a.text.includes(`【${label}】市区町村別人口、人口動態及び世帯数`));
    const t = await table(item, `juki-${kind}-${year}`, `総務省 住民基本台帳に基づく人口、人口動態及び世帯数調査（${label}）`, year, `${year}-01-01`, '住民基本台帳に記録された住民。各年1月1日現在。市区町村単位（政令市は親市、東京特別区は区）。');
    const unitRow = t.rows.findIndex(r => r[0] === '団体コード');
    if (unitRow < 0) throw new Error(`Unknown headers: ${year} ${kind}`);
    const headerIndex = t.rows.findIndex(r => r.includes('男') && r.includes('女') && r.includes('計'));
    const head = t.rows[headerIndex] ?? [];
    const populationHeader = t.rows.slice(0, headerIndex).findLast(r => r.includes('人口')) ?? [];
    const totalCol = head.findIndex((v, i) => v === '計' && populationHeader.slice(0, i + 1).filter(x => x != null).at(-1) === '人口');
    if (totalCol < 0) throw new Error(`No population total: ${year}`);
    maps[kind] = new Map(t.rows.slice(unitRow + 1).filter(r => /^\d{6}$/.test(String(r[0]))).map(r => [String(r[0]).slice(0, 5), typeof r[totalCol] === 'number' ? r[totalCol] : null]));
    sourceIds[kind] = t.sourceId;
    // National includes no designated-city/ward duplication.
    const national = t.rows.find(r => r[1] === '合計');
    maps[kind].set('national', national?.[totalCol] ?? null);
  }
  let sumTotal = 0, sumForeign = 0;
  for (const m of municipalities) {
    const population = NORTHERN_TERRITORIES_CODES.has(m.code) ? null : maps.total.get(m.code) ?? null;
    const foreign = NORTHERN_TERRITORIES_CODES.has(m.code) ? null : maps.foreign.get(m.code) ?? null;
    if (population !== null && foreign !== null && foreign > population) throw new Error(`Foreign > total ${m.code}`);
    if (population !== null) sumTotal += population;
    if (foreign !== null) sumForeign += foreign;
    resident.push({ municipalityCode: m.code, year, population, foreign,
      sourceIds: [sourceIds.foreign, sourceIds.total], status: NORTHERN_TERRITORIES_CODES.has(m.code) ? 'out-of-scope' : population === null || foreign === null ? 'unavailable' : 'published' });
  }
  // Municipality mergers leave historic codes outside today's inventory. Never relabel them.
  if (year === config.resident.endYear && (sumTotal !== maps.total.get('national') || sumForeign !== maps.foreign.get('national'))) {
    throw new Error(`National reconciliation failed ${year}: ${sumTotal}/${maps.total.get('national')}, ${sumForeign}/${maps.foreign.get('national')}`);
  }
  console.log(`Residents ${year}: ${resident.filter(r => r.year === year && r.status === 'published').length} municipalities`);
}
const education = [];
for (const school of [...(config.education.history ?? []), config.education]) {
const schoolYear = school.year;
for (const { stage, listUrl, foreignLabel, totalLabel } of school.tables) {
  const list = articles((await retrieve(listUrl, `school-${stage}-${schoolYear}.html`)).toString());
  function match(label) { return list.find(a => a.text.includes(label)); }
  const f = await table(match(foreignLabel), `school-${stage}-foreign-${schoolYear}`, `文部科学省 学校基本調査 ${foreignLabel}`, schoolYear, `${schoolYear}-05-01`, '都道府県別、学校所在地による集計。国公私立の同じ設置者区分で分母と分子を照合。');
  const t = await table(match(totalLabel), `school-${stage}-total-${schoolYear}`, `文部科学省 学校基本調査 ${totalLabel}`, schoolYear, `${schoolYear}-05-01`, '都道府県別の在籍児童生徒総数。住民登録地による集計ではない。');
  for (const p of prefectures) {
    const name = p.name;
    const fr = f.rows.find(r => String(r[0]).replace(/\s/g, '') === name);
    const tr = t.rows.find(r => String(r[1]).replace(/\s/g, '') === name && r[0] === fiscalYearLabel(schoolYear));
    if (!fr || !tr || typeof fr[1] !== 'number' || typeof tr[2] !== 'number') throw new Error(`School row ${stage} ${name}: ${JSON.stringify(fr)} ${JSON.stringify(tr)}`);
    if (fr[1] > tr[2]) throw new Error(`School numerator > denominator ${name}`);
    education.push({ code: p.code, geography: 'prefecture', year: schoolYear, stage, foreign: fr[1], total: tr[2], sourceIds: [f.sourceId, t.sourceId] });
  }
  console.log(`Education ${stage}: 47 prefectures`);
}
}
const guidanceYear = config.guidance.year;
const guidanceId = `japanese-guidance-${guidanceYear}`;
const guidanceUrl = `https://www.e-stat.go.jp/stat-search/file-download?statInfId=${config.guidance.statInfId}&fileKind=0`;
const guidanceBytes = await retrieve(guidanceUrl, `${guidanceId}.xlsx`);
const guidanceRaw = JSON.parse(execFileSync('python3', [path.join(root, 'scripts/_lib/read-japanese-guidance.py'), path.join(cache, `${guidanceId}.xlsx`), String(guidanceYear)], { maxBuffer: 10 * 1024 * 1024 }));
const guidance = guidanceRaw.filter(r => known.has(r.code)).map(r => ({ ...r, sourceIds: [guidanceId] }));
if (guidance.length < 3000) throw new Error('Japanese guidance municipality coverage too low');
for (const r of guidance) {
  if (r.receivingForeign !== null && r.needsForeign !== null && r.receivingForeign > r.needsForeign) throw new Error(`Guidance receiving > needs ${r.code}`);
}
sources.push({ id: guidanceId, sourceName: `文部科学省 日本語指導が必要な児童生徒の受入状況等に関する調査 市町村別一覧（${guidanceYear}年度）`,
  sourceUrl: `https://www.e-stat.go.jp/stat-search/files?layout=dataset&stat_infid=${config.guidance.statInfId}`, downloadUrl: guidanceUrl,
  year: guidanceYear, period: `${guidanceYear}-05-01`, sourcePublishedAt: config.guidance.publishedAt, updatedAt: new Date().toISOString().slice(0,10),
  definition: '市町村教育委員会所管の公立校。問3の外国籍・日本国籍の日本語指導必要人数、問14（イ）の特別な配慮に基づく指導を受けている外国籍人数、問30の指導体制。学校基本調査の外国籍在籍者総数とは異なる。',
  sha256: crypto.createHash('sha256').update(guidanceBytes).digest('hex'), licenseUrl: 'https://www.e-stat.go.jp/terms-of-use' });
// All files are validated before the generated dataset is replaced.
if (known.size !== municipalities.length || education.length !== 94 * (1 + (config.education.history?.length ?? 0))) throw new Error('Coverage validation failed');
const local = JSON.parse(await fs.readFile(path.join(root, 'data/foreign-resident-issues/local-education.json'), 'utf8'));
for (const source of local.sources) {
  const bytes = await retrieve(source.downloadUrl, `${source.id}.pdf`);
  if (crypto.createHash('sha256').update(bytes).digest('hex') !== source.sha256) throw new Error(`Local school source changed; review observations before publishing: ${source.id}`);
  sources.push({ ...source, updatedAt: new Date().toISOString().slice(0, 10) });
}
const dataset = { schemaVersion: 1, generatedAt: new Date().toISOString(), municipalities, prefectures, resident, education, guidance, localEducation: local.observations, sources };
validateIssueDataset(dataset, config, NORTHERN_TERRITORIES_CODES);
if (!check) {
  await writeDatasetAtomically(output, dataset);
  if (output === path.join(root, 'public/foreign-resident-issues/dataset.json')) await writeIssueChunks(path.dirname(output), dataset);
}
console.log(`${check ? 'Validated (no dataset written)' : `Saved ${output}`}: ${resident.length} resident / ${education.length} education / ${guidance.length} guidance observations`);
