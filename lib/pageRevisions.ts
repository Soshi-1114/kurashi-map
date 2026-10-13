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

function publicationDate(revision: PageRevision, now: Date): Date | undefined {
  const raw = revision.publishedAt;
  if (!revision.evidence.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(raw) || raw > now.toISOString().slice(0, 10)) return undefined;
  const parsed = new Date(`${raw}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === raw ? parsed : undefined;
}

/** 設定ミスをCIで検出する。出力時も不正な履歴は採用しない。 */
export function validatePageRevisions(revisions: readonly PageRevision[], now = new Date()): string[] {
  return revisions.flatMap((revision, index) => {
    const errors: string[] = [];
    if (!publicationDate(revision, now)) errors.push(`revision ${index}: 公開日または証跡が不正です`);
    if ("paths" in revision.scope) {
      if (!revision.scope.paths.length || revision.scope.paths.some((path) => !/^\/(?!\/)[^?#]*$/.test(path))) {
        errors.push(`revision ${index}: canonicalのパスを指定してください`);
      }
    }
    return errors;
  });
}

export function verifiedLastModified(path: string, revisions: readonly PageRevision[] = PAGE_REVISIONS, now = new Date()): Date | undefined {
  let latest: Date | undefined;
  for (const revision of revisions) {
    if (!affects(path, revision)) continue;
    const parsed = publicationDate(revision, now);
    if (parsed && (!latest || parsed > latest)) latest = parsed;
  }
  return latest;
}

export function revisionField(path: string): { lastModified: Date } | Record<string, never> {
  const date = verifiedLastModified(path);
  return date ? { lastModified: date } : {};
}
