/** Verified production publication dates for materially changed pages only. */
export type PageRevision = {
  scope: { paths: readonly string[] } | { template: "municipality" | "prefectureHub" | "mapHub" | "nationalRanking" | "prefRanking" | "prefectureRanking" };
  publishedAt: string; // UTC YYYY-MM-DD
  evidence: string; // production deployment ID or equivalent record
};

// Add entries after the production deployment and the affected URLs are verified.
// Statistic asOf, commit time and build time are not page publication dates.
export const PAGE_REVISIONS: readonly PageRevision[] = [];

const TEMPLATES = {
  municipality: /^\/area\/[^/]+\/\d{5}$/,
  prefectureHub: /^\/area\/[^/]+$/,
  mapHub: /^\/map\/[^/]+$/,
  nationalRanking: /^\/ranking\/[^/]+$/,
  prefRanking: /^\/ranking\/[^/]+\/(?!prefecture$)[^/]+$/,
  prefectureRanking: /^\/ranking\/[^/]+\/prefecture$/,
};

function affects(path: string, revision: PageRevision): boolean {
  return "paths" in revision.scope
    ? revision.scope.paths.includes(path)
    : TEMPLATES[revision.scope.template].test(path);
}

export function verifiedLastModified(path: string, revisions: readonly PageRevision[] = PAGE_REVISIONS): Date | undefined {
  let latest: Date | undefined;
  const today = new Date().toISOString().slice(0, 10);
  for (const revision of revisions) {
    if (!affects(path, revision) || !revision.evidence.trim()) continue;
    const raw = revision.publishedAt;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || raw > today) continue;
    const parsed = new Date(`${raw}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw) continue;
    if (!latest || parsed > latest) latest = parsed;
  }
  return latest;
}

export function revisionField(path: string): { lastModified: Date } | Record<string, never> {
  const date = verifiedLastModified(path);
  return date ? { lastModified: date } : {};
}
