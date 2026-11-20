export function catalogArticles(html) {
  return [...html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/g)].map(m => ({
    text: m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '),
    id: m[1].match(/file-download\?statInfId=(\d+)&(?:amp;)?fileKind=0/)?.[1],
    publishedAt: m[1].match(/公開（更新）日[\s\S]*?(\d{4}-\d{2}-\d{2})/)?.[1] ?? null,
  })).filter(a => a.id);
}
export function matchCatalog(items, label) { return items.find(a => a.text.replace(/\s/g, '').includes(label.replace(/\s/g, ''))); }
export function residentCatalogUrl(year) {
  return `https://www.e-stat.go.jp/stat-search/files?cycle=7&layout=datalist&month=0&page=1&tclass1=000001039601&toukei=00200241&tstat=000001039591&year=${year}0`;
}
export function semanticDataset(data) {
  const { generatedAt: _generatedAt, ...rest } = data;
  return JSON.stringify({ ...rest, sources: data.sources.map(({ updatedAt: _updatedAt, ...source }) => source) });
}

export async function inspectSources(data, config, fetchBytes, calendarYear = new Date().getUTCFullYear()) {
  const changed = []; const candidates = [];
  const byId = new Map(data.sources.map(s => [s.id, s]));
  const inspectList = async (url, entries) => {
    const items = catalogArticles((await fetchBytes(url)).toString());
    if (!items.length) throw new Error(`Missing official catalogue: ${url}`);
    for (const [id, label] of entries) {
      const next = matchCatalog(items, label), old = byId.get(id);
      if (!next || !old) throw new Error(`Missing official table: ${id}`);
      if (new URL(old.downloadUrl).searchParams.get('statInfId') !== next.id || old.sourcePublishedAt !== next.publishedAt) changed.push({ id, reason: 'catalogue', url, statInfId: next.id, publishedAt: next.publishedAt });
    }
  };
  for (let year = config.resident.startYear; year <= config.resident.endYear; year++) await inspectList(residentCatalogUrl(year), [
    [`juki-total-${year}`, '【総計】市区町村別人口、人口動態及び世帯数'], [`juki-foreign-${year}`, '【外国人住民】市区町村別人口、人口動態及び世帯数'],
  ]);
  for (const school of [...config.education.history ?? [], config.education]) for (const table of school.tables) await inspectList(table.listUrl, [
    [`school-${table.stage}-foreign-${school.year}`, table.foreignLabel], [`school-${table.stage}-total-${school.year}`, table.totalLabel],
  ]);
  const changedIds = new Set(changed.map(c => c.id));
  // Hash both tables and curated PDFs; the latter always require a human recheck.
  const { createHash } = await import('node:crypto');
  for (const source of data.sources) {
    if (!source.downloadUrl || changedIds.has(source.id)) continue;
    const hash = createHash('sha256').update(await fetchBytes(source.downloadUrl)).digest('hex');
    if (hash !== source.sha256) changed.push({ id: source.id, reason: 'content', url: source.downloadUrl, sha256: hash,
      manualReview: source.id.startsWith('local-') || source.id.startsWith('japanese-') });
  }
  const probes = [
    { series: 'residents', year: config.resident.endYear + 1, url: residentCatalogUrl(config.resident.endYear + 1), label: '【外国人住民】市区町村別人口、人口動態及び世帯数' },
    { series: 'education', year: config.education.year + 1, url: `https://www.e-stat.go.jp/stat-search/files?layout=datalist&tstat=000001011528&year=${config.education.year + 1}0&query=${encodeURIComponent('都道府県別 外国人')}`, label: '外国人' },
  ];
  for (const probe of probes.filter(p => p.year <= calendarYear)) {
    const html = await fetchBytes(probe.url, true);
    if (!html) continue;
    const items = catalogArticles(html.toString());
    if (items.some(a => a.text.includes(`${probe.year}年`) && a.text.replace(/\s/g, '').includes(probe.label.replace(/\s/g, '')))) candidates.push(probe);
  }
  return { changed, candidates, requiresManualReview: changed.some(c => c.manualReview) };
}
