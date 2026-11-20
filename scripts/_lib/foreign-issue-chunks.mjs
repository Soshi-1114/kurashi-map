import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { writeDatasetAtomically } from './foreign-resident-update.mjs';

export function issueChunks(data) {
  const years = records => [...new Set(records.map(r => r.year))].sort((a, b) => a - b);
  const residentYears = years(data.resident);
  const latestResidentYear = residentYears.at(-1);
  const manifest = { schemaVersion: 1, generatedAt: data.generatedAt, municipalities: data.municipalities,
    prefectures: data.prefectures, sources: data.sources, localEducation: data.localEducation ?? [],
    years: { residents: residentYears, education: years(data.education), guidance: years(data.guidance) },
    excludedMunicipalityCodes: data.resident.filter(r => r.year === latestResidentYear && r.status === 'out-of-scope').map(r => r.municipalityCode),
    files: { residents: {}, residentHistory: {}, education: {}, guidance: {} } };
  const chunks = [];
  function add(group, key, records) {
    const json = JSON.stringify(records);
    const sha256 = createHash('sha256').update(json).digest('hex');
    const relative = `chunks/${group}/${key}.${sha256.slice(0, 16)}.json`;
    manifest.files[group][key] = { url: `/foreign-resident-issues/${relative}`, sha256, bytes: Buffer.byteLength(json), rows: records.length };
    chunks.push({ relative, records });
  }
  for (const year of manifest.years.residents) add('residents', year, data.resident.filter(r => r.year === year));
  for (const pref of data.prefectures) {
    const codes = new Set(data.municipalities.filter(m => m.pref === pref.slug).map(m => m.code));
    add('residentHistory', pref.slug, data.resident.filter(r => codes.has(r.municipalityCode)));
  }
  for (const year of manifest.years.education) add('education', year, data.education.filter(r => r.year === year));
  for (const year of manifest.years.guidance) add('guidance', year, data.guidance.filter(r => r.year === year));
  return { manifest, chunks };
}

export async function writeIssueChunks(directory, data) {
  const { manifest, chunks } = issueChunks(data);
  // Content-addressed files first, manifest last. Keep older files for in-flight clients.
  for (const chunk of chunks) await writeDatasetAtomically(path.join(directory, chunk.relative), chunk.records);
  await writeDatasetAtomically(path.join(directory, 'manifest.json'), manifest);
  return manifest;
}
