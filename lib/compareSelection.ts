import { MAX_COMPARE, parseToolSource, type ToolSource } from "./siteNav";

export type CompareCandidate = {
  code: string;
  name: string;
  pref: string;
  source: ToolSource;
};

/** sessionStorage由来の値と画面間の更新を、保存契約に沿う最大3件へ正規化する。 */
export function normalizeCompareCandidates(value: unknown): CompareCandidate[] {
  if (!Array.isArray(value)) return [];
  const result: CompareCandidate[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Partial<CompareCandidate>;
    if (!/^\d{5}$/.test(candidate.code ?? "") || typeof candidate.name !== "string" || !candidate.name.trim() ||
        typeof candidate.pref !== "string" || !candidate.pref.trim() || result.some((x) => x.code === candidate.code)) continue;
    result.push({
      code: candidate.code!,
      name: candidate.name.trim().slice(0, 80),
      pref: candidate.pref.trim().slice(0, 40),
      source: parseToolSource(candidate.source ?? null) ?? "home",
    });
    if (result.length === MAX_COMPARE) break;
  }
  return result;
}
