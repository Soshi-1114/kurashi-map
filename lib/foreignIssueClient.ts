import type { IssuesDataset, IssueTheme, ResidentObservation, EducationObservation, GuidanceObservation } from './foreignResidentIssues';

export type IssueFile = { url: string; sha256: string; bytes: number; rows: number };
export type IssueManifest = Pick<IssuesDataset, 'schemaVersion' | 'generatedAt' | 'municipalities' | 'prefectures' | 'sources' | 'localEducation'> & {
  years: Record<IssueTheme, number[]>; excludedMunicipalityCodes: string[];
  files: Record<'residents' | 'residentHistory' | 'education' | 'guidance', Record<string, IssueFile>>;
};
type Fetcher = (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

/** Per-explorer cache. Failed requests are retryable; no legacy full-JSON fallback. */
export class ForeignIssueClient {
  private pending = new Map<string, Promise<unknown>>();
  constructor(private fetcher: Fetcher = url => fetch(url)) {}
  private async get(url: string): Promise<unknown> {
    let result = this.pending.get(url);
    if (!result) {
      result = this.fetcher(url).then(r => { if (!r.ok) throw new Error('統計データ取得失敗'); return r.json(); });
      this.pending.set(url, result);
      result.catch(() => { this.pending.delete(url); });
    }
    return result;
  }
  async manifest(): Promise<IssueManifest> {
    const m = await this.get('/foreign-resident-issues/manifest.json') as IssueManifest;
    if (m.schemaVersion !== 1 || !m.sources?.length || !m.municipalities?.length || !m.files || ['residents', 'education', 'guidance'].some(t => !m.years?.[t as IssueTheme]?.length)) throw new Error('統計台帳の形式不正');
    return m;
  }
  private async records<T>(file: IssueFile): Promise<T[]> {
    if (!/^\/foreign-resident-issues\/chunks\/[A-Za-z]+\/[a-z0-9-]+\.[a-f0-9]{16}\.json$/.test(file.url)) throw new Error('統計ファイルのURL不正');
    const rows = await this.get(file.url);
    if (!Array.isArray(rows) || rows.length !== file.rows) { this.pending.delete(file.url); throw new Error('統計ファイルの件数不正'); }
    return rows as T[];
  }
  async load(m: IssueManifest, theme: IssueTheme, year: number, historyCodes: string[]): Promise<IssuesDataset> {
    if (!m.years[theme].includes(year)) throw new Error('未収録の年度');
    const data: IssuesDataset = { schemaVersion: 1, generatedAt: m.generatedAt, municipalities: m.municipalities, prefectures: m.prefectures, sources: m.sources, localEducation: m.localEducation, resident: [], education: [], guidance: [] };
    if (theme === 'residents') {
      const files = [0, 1, 5, 10].flatMap(lag => m.files.residents[year - lag] ? [m.files.residents[year - lag]] : []);
      const prefs = new Set(historyCodes.flatMap(code => m.municipalities.find(r => r.code === code)?.pref ?? []));
      for (const pref of prefs) if (m.files.residentHistory[pref]) files.push(m.files.residentHistory[pref]);
      const rows = (await Promise.all(files.map(f => this.records<ResidentObservation>(f)))).flat();
      data.resident = [...new Map(rows.map(r => [`${r.municipalityCode}:${r.year}`, r])).values()];
    } else if (theme === 'education') {
      const years = historyCodes.length ? m.years.education : [year];
      data.education = (await Promise.all(years.map(y => this.records<EducationObservation>(m.files.education[y])))).flat();
    } else data.guidance = await this.records<GuidanceObservation>(m.files.guidance[year]);
    return data;
  }
}
