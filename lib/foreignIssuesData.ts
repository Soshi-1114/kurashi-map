import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { cache } from 'react';
import type { IssuesDataset } from './foreignResidentIssues';

/** Server-only loader: the full historical dataset is never passed to ranking clients. */
export const loadForeignIssuesData = cache(async (): Promise<IssuesDataset> =>
  JSON.parse(await readFile(path.join(process.cwd(), 'public/foreign-resident-issues/dataset.json'), 'utf8')));
