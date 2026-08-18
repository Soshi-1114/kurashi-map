import { describe, expect, it } from "vitest";
import type { MetadataRoute } from "next";
import sitemap from "@/app/sitemap";
import { TEMPLATE_REVISED_AT, parseAsOf } from "@/lib/dataFreshness";
import { absoluteUrl } from "@/lib/site";

// lastmod の同一日付潰れ（2026-08 に 2,744 URL 中 2,734 件が揃った退行）の再発防止。
// 方針の正典は lib/dataFreshness.ts のコメント。
const day = (e: MetadataRoute.Sitemap[number]) =>
  (e.lastModified as Date).toISOString().slice(0, 10);

describe("sitemap の lastModified", () => {
  const entriesP = sitemap();

  it("同一日付への潰れがない（最多日付のシェアが 9 割未満・日付が複数種）", async () => {
    const entries = await entriesP;
    expect(entries.length).toBeGreaterThan(2000);
    const byDay = new Map<string, number>();
    for (const e of entries) {
      byDay.set(day(e), (byDay.get(day(e)) ?? 0) + 1);
    }
    const top = Math.max(...byDay.values());
    expect(byDay.size).toBeGreaterThanOrEqual(3);
    expect(top / entries.length).toBeLessThan(0.9);
  });

  it("/map/* はテンプレ改訂日（mapHub）以降になる", async () => {
    const entries = await entriesP;
    const hubs = entries.filter((e) => e.url.startsWith(absoluteUrl("/map/")));
    expect(hubs.length).toBe(5);
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
