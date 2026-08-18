import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { TEMPLATE_REVISED_AT } from "@/lib/dataFreshness";
import { absoluteUrl } from "@/lib/site";

// sitemap の lastmod はページごとに分散していてこそ鮮度シグナルとして信頼される。
// 2026-08 にテンプレ改訂日を全ページ種別へ適用した結果、2,744 URL 中 2,734 件が
// 同一日付に潰れた退行を防ぐ（lib/dataFreshness.ts のコメント参照）。
describe("sitemap の lastModified", () => {
  const entriesP = sitemap();

  it("同一日付への潰れがない（最多日付のシェアが 9 割未満・日付が複数種）", async () => {
    const entries = await entriesP;
    expect(entries.length).toBeGreaterThan(2000);
    const byDay = new Map<string, number>();
    for (const e of entries) {
      const day = new Date(e.lastModified as Date | string).toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }
    const top = Math.max(...byDay.values());
    expect(byDay.size).toBeGreaterThanOrEqual(3);
    expect(top / entries.length).toBeLessThan(0.9);
  });

  it("/map/* はテンプレ改訂日（mapHub）以降になる", async () => {
    const entries = await entriesP;
    const hubs = entries.filter((e) => e.url.includes("/map/"));
    expect(hubs.length).toBe(5);
    const revised = new Date(`${TEMPLATE_REVISED_AT.mapHub}T00:00:00Z`).getTime();
    for (const e of hubs) {
      expect(new Date(e.lastModified as Date | string).getTime()).toBeGreaterThanOrEqual(revised);
    }
  });

  it("自治体ページの lastmod はテンプレ改訂日ではなくデータ asOf 由来で分散する", async () => {
    const entries = await entriesP;
    const munis = entries.filter((e) => /\/area\/[a-z-]+\/\d{5}$/.test(e.url));
    expect(munis.length).toBeGreaterThan(1900);
    const days = new Set(
      munis.map((e) => new Date(e.lastModified as Date | string).toISOString().slice(0, 10)),
    );
    expect(days.size).toBeGreaterThanOrEqual(2);
  });

  it("トップの loc は末尾スラッシュ付き canonical と一致する", async () => {
    const entries = await entriesP;
    expect(entries[0]?.url).toBe(absoluteUrl("/"));
  });
});
