import type { MetadataRoute } from "next";
import type { Municipality } from "@/lib/types";
import { listAllAcrossPrefs } from "@/lib/metrics";
import { PREFS } from "@/lib/prefs";
import { RANKINGS, muniLevelOnly } from "@/lib/rankings";
import { PREF_RANKINGS } from "@/lib/prefRankings";
import { revisionField } from "@/lib/pageRevisions";
import { absoluteUrl } from "@/lib/site";
import { GENERAL_MAP, MAP_HUBS } from "@/lib/siteNav";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const all = await listAllAcrossPrefs();
  // 県別ランキングに対象データがあるか判定するために県ごとにまとめる。
  const byPref = new Map<string, Municipality[]>();
  for (const m of all) {
    const g = byPref.get(m.pref);
    if (g) g.push(m);
    else byPref.set(m.pref, [m]);
  }
  const entries: MetadataRoute.Sitemap = [
    {
      // トップの canonical は末尾スラッシュ付き（absoluteUrl("/") = https://kurashimap.jp/）。
      // sitemap の loc も揃えて重複（slash有無）判定のノイズを避ける。
      url: absoluteUrl("/"),
      ...revisionField("/"),
      changeFrequency: "weekly",
      priority: 1,
    },
    // 汎用の全画面地図（「地図で見る」ディープリンクの既定の行き先）。
    {
      url: absoluteUrl(GENERAL_MAP.href),
      ...revisionField(GENERAL_MAP.href),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    // 指標別 地図ハブ（ピラーページ群）。一覧は lib/siteNav.ts が単一ソース。
    ...MAP_HUBS.map((hub) => ({
      url: absoluteUrl(hub.href),
      ...revisionField(hub.href),
      changeFrequency: "monthly" as const,
      priority: hub.sitemapPriority,
    })),
    // 自治体比較ページ（選択状態はクエリなので URL はベースの1件のみ）。
    {
      url: absoluteUrl("/compare"),
      ...revisionField("/compare"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    // 住む街診断（回答状態はクエリなので URL はベースの1件のみ）。
    {
      url: absoluteUrl("/shindan"),
      ...revisionField("/shindan"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    // 電気代シミュレーター（横断ツール。?code= プリセットは同一ページの状態なので URL は1件）。
    {
      url: absoluteUrl("/denki"),
      ...revisionField("/denki"),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    // サイトについて（データの出典・更新方針。E-E-A-T ページ）。
    {
      url: absoluteUrl("/about"),
      ...revisionField("/about"),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    // プライバシーポリシー（GA4 開示。更新頻度は低い）。
    {
      url: absoluteUrl("/privacy"),
      ...revisionField("/privacy"),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    // ランキング一覧 + 各ランキング（比較系クエリの入口）。
    {
      url: absoluteUrl("/ranking"),
      ...revisionField("/ranking"),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...RANKINGS.map((r) => ({
      url: absoluteUrl(`/ranking/${r.slug}`),
      ...revisionField(`/ranking/${r.slug}`),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    // 都道府県ランキング（47都道府県を1本に並べたページ。実数合算で県の値を出す指標のみ）。
    ...PREF_RANKINGS.map((r) => ({
      url: absoluteUrl(`/ranking/${r.slug}/prefecture`),
      ...revisionField(`/ranking/${r.slug}/prefecture`),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    // 県別ランキング（県 × 指標。該当データのある組み合わせのみ）
    ...PREFS.flatMap((p) => {
      const munis = muniLevelOnly(byPref.get(p.slug) ?? []);
      return RANKINGS.filter((r) => munis.some((m) => r.qualifies(m))).map((r) => ({
        url: absoluteUrl(`/ranking/${r.slug}/${p.slug}`),
        ...revisionField(`/ranking/${r.slug}/${p.slug}`),
        changeFrequency: "monthly" as const,
        priority: 0.6,
      }));
    }),
    // 県別ハブページ（全自治体への内部リンク集約・検索の入口）
    ...PREFS.map((p) => ({
      url: absoluteUrl(`/area/${p.slug}`),
      ...revisionField(`/area/${p.slug}`),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...all.map((m) => ({
      url: absoluteUrl(`/area/${m.pref}/${m.code}`),
      ...revisionField(`/area/${m.pref}/${m.code}`),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
  return entries;
}
