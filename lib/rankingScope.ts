import { PREFS, REGIONS } from "./prefs";

export type RankingRow = { code: string; name: string; pref: string; value: string };
export type RankingScope = "all" | `region:${string}` | `pref:${string}`;

export function parseRankingScope(value: string | null, pref?: string): RankingScope {
  if (value && REGIONS.some(r => `region:${r.key}` === value)) return value as RankingScope;
  if (value && PREFS.some(p => `pref:${p.slug}` === value)) return value as RankingScope;
  return pref && PREFS.some(p => p.slug === pref) ? `pref:${pref}` : "all";
}

export function rankingScopeLabel(scope: RankingScope): string {
  if (scope.startsWith("region:")) return REGIONS.find(r => `region:${r.key}` === scope)?.nameJa ?? "全国";
  if (scope.startsWith("pref:")) return PREFS.find(p => `pref:${p.slug}` === scope)?.nameJa ?? "全国";
  return "全国";
}

/** 入力は全有効自治体を指標順に整列した配列。上位100件に切る前に地域を絞る。 */
export function scopedRankingRows(rows: RankingRow[], scope: RankingScope) {
  const region = REGIONS.find(r => `region:${r.key}` === scope);
  return rows.filter(row => scope === "all" || (region
    ? region.prefixes.includes(row.code.slice(0, 2))
    : `pref:${row.pref}` === scope));
}

export function rankingScopeHref(metric: string, scope: RankingScope): string {
  const base = `/ranking/${metric}`;
  if (scope.startsWith("pref:")) return `${base}/${scope.slice(5)}`;
  return scope.startsWith("region:") ? `${base}?region=${encodeURIComponent(scope.slice(7))}` : base;
}

export function rankingFeedbackPage(metric: string, scope: RankingScope): string {
  return `ranking:${metric}${scope === "all" ? "" : `:${scope}`}`;
}
