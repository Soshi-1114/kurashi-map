import fs from 'node:fs/promises';
import path from 'node:path';
import { writeIssueChunks } from './_lib/foreign-issue-chunks.mjs';
const root = path.resolve(import.meta.dirname, '..');
const input = process.argv[2] ?? path.join(root, 'public/foreign-resident-issues/dataset.json');
const directory = process.argv[3] ?? path.join(root, 'public/foreign-resident-issues');
const data = JSON.parse(await fs.readFile(input, 'utf8'));
const manifest = await writeIssueChunks(directory, data);
console.log(`Generated ${Object.values(manifest.files).reduce((n, files) => n + Object.keys(files).length, 0)} content-addressed files and manifest`);
