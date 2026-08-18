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
  // lastModified はデータの実 vintage（asOf）から導く。毎ビルド now を入れると
  // 「常に全更新」のノイズ信号になるため、データ更新時だけ日付が動くようにする。
  // テンプレート改訂（title 刷新・セクション追加など）は URL 数の少ないページ種別
  // （/denki・/map/*）に限り TEMPLATE_REVISED_AT との新しい方を採る。大量ページ種別
  // （自治体・県ハブ・ランキング系）に適用すると全 URL が同一日付に潰れて
  // 鮮度シグナル自体を毀損するため適用しない（lib/dataFreshness.ts 参照）。
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

  const entries: MetadataRoute.Sitemap = [
    {
      // トップの canonical は末尾スラッシュ付き（absoluteUrl("/") = https://kurashimap.jp/）。
      // sitemap の loc も揃えて重複（slash有無）判定のノイズを避ける。
      url: absoluteUrl("/"),
      lastModified: siteLatest,
      changeFrequency: "weekly",
      priority: 1,
    },
    // ピラーページ（「外国人 割合 地図」「在留外国人 ヒートマップ」の入口・トピッククラスタのハブ）。
    {
      url: absoluteUrl("/map/foreign-ratio"),
      lastModified: withTemplateRevision(siteLatest, TEMPLATE_REVISED_AT.mapHub),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    // 指標別 地図ハブ（家賃・地価・人口増減・将来人口。/map/foreign-ratio と同構成のピラー群）。
    ...["/map/rent", "/map/land-price", "/map/population-trend", "/map/future-population"].map((path) => ({
      url: absoluteUrl(path),
      lastModified: withTemplateRevision(siteLatest, TEMPLATE_REVISED_AT.mapHub),
      changeFrequency: "monthly" as const,
      priority: 0.8,
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
        lastModified: prefLatest.get(p.slug) ?? siteLatest,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      }));
    }),
    // 県別ハブページ（全自治体への内部リンク集約・検索の入口）
    ...PREFS.map((p) => ({
      url: absoluteUrl(`/area/${p.slug}`),
      lastModified: prefLatest.get(p.slug) ?? siteLatest,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...all.map((m) => ({
      url: absoluteUrl(`/area/${m.pref}/${m.code}`),
      lastModified: muniLastModified(m) ?? prefLatest.get(m.pref) ?? siteLatest,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
  return entries;
}
