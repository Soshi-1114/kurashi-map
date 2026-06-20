import type { MetadataRoute } from "next";
import { listAllAcrossPrefs } from "@/lib/metrics";
import { PREFS } from "@/lib/prefs";
import { RANKINGS } from "@/lib/rankings";
import { SITE, absoluteUrl } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const all = await listAllAcrossPrefs();
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    {
      url: SITE.baseUrl,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    // ランキング一覧 + 各ランキング（比較系クエリの入口）
    {
      url: absoluteUrl("/ranking"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...RANKINGS.map((r) => ({
      url: absoluteUrl(`/ranking/${r.slug}`),
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    // 県別ハブページ（全自治体への内部リンク集約・検索の入口）
    ...PREFS.map((p) => ({
      url: absoluteUrl(`/area/${p.slug}`),
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...all.map((m) => ({
      url: absoluteUrl(`/area/${m.pref}/${m.code}`),
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
  return entries;
}
