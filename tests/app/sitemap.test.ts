import { describe, expect, it } from "vitest";
import type { MetadataRoute } from "next";
import sitemap from "@/app/sitemap";
import { TEMPLATE_REVISED_AT, parseAsOf } from "@/lib/dataFreshness";
import { MAP_HUBS } from "@/lib/siteNav";
import { absoluteUrl } from "@/lib/site";

// lastmod の同一日付潰れ（2026-08 に 2,744 URL 中 2,734 件が揃った退行）の再発防止。
// 方針の正典は lib/dataFreshness.ts のコメント。
const day = (e: MetadataRoute.Sitemap[number]) =>
  (e.lastModified as Date).toISOString().slice(0, 10);

describe("sitemap の lastModified", () => {
  const entriesP = sitemap();

  it("同一日付への潰れがない（テンプレ改訂日での全一致を検出）", async () => {
    const entries = await entriesP;
    expect(entries.length).toBeGreaterThan(2000);
    const byDay = new Map<string, number>();
    for (const e of entries) {
      byDay.set(day(e), (byDay.get(day(e)) ?? 0) + 1);
    }
    const top = Math.max(...byDay.values());
    expect(byDay.size).toBeGreaterThanOrEqual(3);
    // ガード対象はテンプレ改訂日が全URLに漏れる退行（2026-08 実績: 2,734/2,744 = 99.64%）。
    // 一方、全国一斉の年次データ更新（例: CFA 令和8年版）では自治体ページの大半が
    // 新しい実 vintage に「正当に」揃う（実測 ~99.4%）。境界 0.996 で両者を区別しつつ、
    // 最多日付がテンプレ改訂日そのものでないことも確認する。
    expect(top / entries.length).toBeLessThan(0.996);
    const topDay = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0][0];
    for (const revised of Object.values(TEMPLATE_REVISED_AT)) {
      expect(topDay).not.toBe(parseAsOf(revised)!.toISOString().slice(0, 10));
    }
  });

  it("/map/* はテンプレ改訂日（mapHub）以降になる", async () => {
    const entries = await entriesP;
    const hubs = entries.filter((e) => e.url.startsWith(absoluteUrl("/map/")));
    expect(hubs.length).toBe(MAP_HUBS.length);
    const revised = parseAsOf(TEMPLATE_REVISED_AT.mapHub)!.getTime();
    for (const e of hubs) {
      expect((e.lastModified as Date).getTime()).toBeGreaterThanOrEqual(revised);
    }
  });

  it("自治体ページの lastmod はテンプレ改訂日ではなくデータ asOf 由来で分散する", async () => {
    const entries = await entriesP;
    const munis = entries.filter(
      (e) => e.url.startsWith(absoluteUrl("/area/")) && /\/\d{5}$/.test(e.url),
    );
    expect(munis.length).toBeGreaterThan(1900);
    expect(new Set(munis.map(day)).size).toBeGreaterThanOrEqual(2);
  });
});
