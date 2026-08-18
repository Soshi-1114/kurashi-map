import type { MetadataRoute } from "next";
import type { Municipality } from "@/lib/types";
import { listAllAcrossPrefs } from "@/lib/metrics";
import { PREFS } from "@/lib/prefs";
import { RANKINGS, muniLevelOnly } from "@/lib/rankings";
import {
  TEMPLATE_REVISED_AT,
  latestLastModified,
  muniLastModified,
  withTemplateRevision,
} from "@/lib/dataFreshness";
import { absoluteUrl } from "@/lib/site";
import { denkiPlansLastModified } from "@/lib/denkiPlans";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const all = await listAllAcrossPrefs();
  // lastModified はデータの実 vintage（asOf）から導く。テンプレート改訂日
  // （TEMPLATE_REVISED_AT）を効かせるのは URL 数の少ない /denki・/map/* のみ。
  // 理由と運用は lib/dataFreshness.ts のコメントが正典。
  const fallback = new Date();
  const siteLatest = latestLastModified(all) ?? fallback;

  // 県ごとに自治体をまとめ、県単位の最新 asOf を1度だけ算出（ハブ + 各自治体で共有）。
  const byPref = new Map<string, Municipality[]>();
  for (const m of all) {
    const g = byPref.get(m.pref);
    if (g) g.push(m);
    else byPref.set(m.pref, [m]);
  }
  const prefLatest = new Map<string, Date>();
  for (const [slug, munis] of byPref) {
    prefLatest.set(slug, latestLastModified(munis) ?? siteLatest);
  }
  // prefLatest は byPref の全キーに値を入れているので、既知 slug では必ずヒットする。
  // ?? siteLatest は型を Date に絞るためのフォールバック。
  const prefDate = (slug: string): Date => prefLatest.get(slug) ?? siteLatest;

  const entries: MetadataRoute.Sitemap = [
    {
      // トップの canonical は末尾スラッシュ付き（absoluteUrl("/") = https://kurashimap.jp/）。
      // sitemap の loc も揃えて重複（slash有無）判定のノイズを避ける。
      url: absoluteUrl("/"),
      lastModified: siteLatest,
      changeFrequency: "weekly",
      priority: 1,
    },
    // 指標別 地図ハブ（ピラーページ群）。foreign-ratio は「外国人 割合 地図」等の
    // 主力クエリの入口なので priority だけ高い。
    ...([
      ["/map/foreign-ratio", 0.9],
      ["/map/rent", 0.8],
      ["/map/land-price", 0.8],
      ["/map/population-trend", 0.8],
      ["/map/future-population", 0.8],
    ] as const).map(([path, priority]) => ({
      url: absoluteUrl(path),
      lastModified: withTemplateRevision(siteLatest, TEMPLATE_REVISED_AT.mapHub),
      changeFrequency: "monthly" as const,
      priority,
    })),
    // 自治体比較ページ（選択状態はクエリなので URL はベースの1件のみ）。
    {
      url: absoluteUrl("/compare"),
      lastModified: siteLatest,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    // 電気代シミュレーター（横断ツール。?code= プリセットは同一ページの状態なので URL は1件）。
    // lastModified は料金プランデータの確認時点（data/denki-plans.json の asOf）と
    // テンプレート改訂日の新しい方。priority は全自治体詳細から導線が張られる
    // ツールピラーとして /map/* と同格の 0.8。
    {
      url: absoluteUrl("/denki"),
      lastModified: withTemplateRevision(denkiPlansLastModified(), TEMPLATE_REVISED_AT.denki),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    // サイトについて（データの出典・更新方針。E-E-A-T ページ）。
    {
      url: absoluteUrl("/about"),
      lastModified: siteLatest,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    // プライバシーポリシー（GA4 開示。更新頻度は低い）。
    {
      url: absoluteUrl("/privacy"),
      lastModified: siteLatest,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    // ランキング一覧 + 各ランキング（比較系クエリの入口）。中身は全データ由来なのでサイト最新。
    {
      url: absoluteUrl("/ranking"),
      lastModified: siteLatest,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...RANKINGS.map((r) => ({
      url: absoluteUrl(`/ranking/${r.slug}`),
      lastModified: siteLatest,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    // 県別ランキング（県 × 指標。該当データのある組み合わせのみ）
    ...PREFS.flatMap((p) => {
      const munis = muniLevelOnly(byPref.get(p.slug) ?? []);
      return RANKINGS.filter((r) => munis.some((m) => r.qualifies(m))).map((r) => ({
        url: absoluteUrl(`/ranking/${r.slug}/${p.slug}`),
        lastModified: prefDate(p.slug),
        changeFrequency: "monthly" as const,
        priority: 0.6,
      }));
    }),
    // 県別ハブページ（全自治体への内部リンク集約・検索の入口）
    ...PREFS.map((p) => ({
      url: absoluteUrl(`/area/${p.slug}`),
      lastModified: prefDate(p.slug),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...all.map((m) => ({
      url: absoluteUrl(`/area/${m.pref}/${m.code}`),
      lastModified: muniLastModified(m) ?? prefDate(m.pref),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
  return entries;
}
