// Read public sources. Only --apply may update allowlisted local data/report files.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { inspectSources, semanticDataset } from './_lib/foreign-source-catalog.mjs';
import { validateUpdateConfig, validateIssueDataset, writeDatasetAtomically } from './_lib/foreign-resident-update.mjs';
import { NORTHERN_TERRITORIES_CODES } from './_lib/prefs.mjs';
import { writeIssueChunks } from './_lib/foreign-issue-chunks.mjs';
const args = process.argv.slice(2);
if (args.some(a => a !== '--apply')) throw new Error('Only --apply is supported');
const root = path.resolve(import.meta.dirname, '..');
const filename = path.join(root, 'public/foreign-resident-issues/dataset.json');
const data = JSON.parse(await fs.readFile(filename, 'utf8'));
const config = validateUpdateConfig(JSON.parse(await fs.readFile(path.join(root, 'scripts/config/foreign-resident-issues.json'), 'utf8')));
async function fetchBytes(url, allow404 = false) {
  if (new URL(url).protocol !== 'https:') throw new Error('HTTPS sources required');
  let response;
  for (let attempt = 0; attempt < 3; attempt++) {
    response = await fetch(url, { signal: AbortSignal.timeout(45_000) });
    if (response.ok || (allow404 && response.status === 404)) break;
    if (response.status < 500 && response.status !== 429) break;
  }
  if (allow404 && response.status === 404) return null;
  if (!response.ok) throw new Error(`Official source HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
const result = await inspectSources(data, config, fetchBytes);
console.log(JSON.stringify(result, null, 2));
if (!args.includes('--apply') || (!result.changed.length && !result.candidates.length)) process.exit(0);
const reportFile = path.join(root, 'docs/data-updates/foreign-resident-issues.json');
let oldReport = null;
try { oldReport = JSON.parse(await fs.readFile(reportFile, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
// No timestamp-only PR when an already-reviewed candidate is still awaiting configuration.
if (JSON.stringify(oldReport?.result) === JSON.stringify(result)) process.exit(0);
if (result.changed.length && !result.requiresManualReview) {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'foreign-update-'));
  try {
    const candidate = path.join(temp, 'dataset.json');
    execFileSync(process.execPath, [path.join(root, 'scripts/build-foreign-resident-issues.mjs'), '--refresh', '--cache-dir', path.join(temp, 'cache'), '--output', candidate], { stdio: 'inherit', timeout: 30 * 60_000 });
    const next = JSON.parse(await fs.readFile(candidate, 'utf8'));
    validateIssueDataset(next, config, NORTHERN_TERRITORIES_CODES);
    if (semanticDataset(next) !== semanticDataset(data)) {
      await writeDatasetAtomically(filename, next);
      await writeIssueChunks(path.dirname(filename), next);
    }
  } finally { await fs.rm(temp, { recursive: true, force: true }); }
}
await writeDatasetAtomically(reportFile, { checkedAt: new Date().toISOString(), result,
  note: '新年度の原典・自治体PDF・日本語指導の変更は手動で定義と観測値を確認してください。自動マージ・本番デプロイは行いません。' });
