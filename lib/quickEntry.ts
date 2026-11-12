import { DENKI_AREAS, type DenkiArea } from "./denki";

export const QUICK_ENTRY_VERSION = "2026-10-31";

/** 初回14日評価後に有効化する。Nextのビルド時フラグで、本番は既定で従来版。 */
export function quickEntryPresentation(tool: "denki" | "stockpile") {
  const improved = process.env.NEXT_PUBLIC_QUICK_ENTRY_V2 === "true";
  return {
    improved,
    measurement_version: improved ? "2026-11-12" : QUICK_ENTRY_VERSION,
    cta_variant: tool === "denki" ? (improved ? "people-buttons-v2" : "inline-v1") : (improved ? "water-buttons-v2" : "water-inline-v1"),
  };
}
const MAX_AGE = 30 * 60 * 1000;
export type QuickEntry =
  | { tool: "denki"; people: number; area: DenkiArea; code: string; from: "area_detail" }
  | { tool: "stockpile"; people: number; days: 3 | 7; from: "area" | "hazard-map" };
const key = (tool: QuickEntry["tool"]) => `kurashimap-quick-${tool}-v1`;
function valid(value: QuickEntry): boolean {
  if (!value || !Number.isInteger(value.people) || value.people < 1) return false;
  if (value.tool === "denki") return value.people <= 5 && DENKI_AREAS.includes(value.area) && /^\d{5}$/.test(value.code) && value.from === "area_detail";
  return value.tool === "stockpile" && value.people <= 20 && [3, 7].includes(value.days) && ["area", "hazard-map"].includes(value.from);
}
/** 入力値はURLやGA4へ渡さず、このタブ内でのみ短時間引き継ぐ。 */
export function saveQuickEntry(value: QuickEntry): void {
  try { if (valid(value)) sessionStorage.setItem(key(value.tool), JSON.stringify({ value, createdAt: Date.now() })); } catch { /* 保存不可でもリンクは利用できる。 */ }
}
export function takeQuickEntry<T extends QuickEntry["tool"]>(tool: T, search: string): Extract<QuickEntry, { tool: T }> | null {
  const params = new URLSearchParams(search);
  if (params.get("quick") !== "1") return null;
  try {
    const raw = sessionStorage.getItem(key(tool));
    sessionStorage.removeItem(key(tool));
    if (!raw) return null;
    const { value, createdAt } = JSON.parse(raw);
    const age = Date.now() - createdAt;
    if (!Number.isFinite(createdAt) || age < 0 || age > MAX_AGE || !valid(value) || value.tool !== tool || value.from !== params.get("from")) return null;
    if (value.tool === "denki" && value.code !== params.get("code")) return null;
    return value;
  } catch { return null; }
}
