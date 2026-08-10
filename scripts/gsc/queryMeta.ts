// 検索クエリの正規化・分類。判定ルールは config.ts の QUERY_CATEGORY_PATTERNS に集約し、
// ここでは「branded → municipality（自治体マスタと突合） → テーマ別パターン → other」の
// 判定順序だけを持つ（ルールの追加・変更は config.ts の編集だけで完結する設計）。

import { MIN_MUNI_NAME_MATCH_LENGTH, QUERY_CATEGORY_PATTERNS } from "./config";
import type { MuniMeta, QueryCategory } from "./types";

export function normalizeQuery(q: string): string {
  return q.trim().replace(/\s+/g, " ");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export type MuniNameMatcher = (query: string) => string | null;

/**
 * 自治体マスタから「クエリに自治体名を含むか」を判定する1つの正規表現を組み立てる。
 * 1件ずつ 1,918 自治体名と includes() 比較すると遅いため、事前に1つの alternation に
 * まとめる（長い名前を先に試すことで部分一致の誤判定を減らす。例:「京都市」>「京都」）。
 */
export function buildMuniNameMatcher(muniMaster: Map<string, MuniMeta>): MuniNameMatcher {
  const names = [...new Set([...muniMaster.values()].flatMap((m) => [m.name, m.displayName]))]
    .filter((n): n is string => Boolean(n) && n.length >= MIN_MUNI_NAME_MATCH_LENGTH)
    .sort((a, b) => b.length - a.length);
  if (names.length === 0) return () => null;
  const pattern = new RegExp(names.map(escapeRegExp).join("|"));
  return (query: string) => {
    const m = query.match(pattern);
    return m ? m[0] : null;
  };
}

export function classifyQuery(query: string, matchMuniName: MuniNameMatcher): QueryCategory {
  if (QUERY_CATEGORY_PATTERNS.branded?.test(query)) return "branded";
  if (matchMuniName(query)) return "municipality";
  for (const [category, pattern] of Object.entries(QUERY_CATEGORY_PATTERNS)) {
    if (category === "branded") continue;
    if (pattern?.test(query)) return category as QueryCategory;
  }
  return "other";
}
