# GSC分析に基づくSEO実装計画（2026-08）

一次資料: [`kurashimap-gsc-analysis-2026-08-10.md`](./kurashimap-gsc-analysis-2026-08-10.md) /
[`kurashimap-seo-improvement-priorities-2026-08-10.md`](./kurashimap-seo-improvement-priorities-2026-08-10.md)
（`npm run gsc:analyze -- --days 28 --compare` の実データを基に生成）。

## Background

直近28日: 814 clicks / 23,900 impressions / CTR 3.41% / 平均掲載順位11.1（前28日比 +803% / +474%）。

- `ranking`: 591 clicks / 15,373 impressions / 平均順位8.3（全クリックの72.6%）
- `municipality`: 183 clicks / 5,404 impressions / 平均順位8.1
- `prefecture`: 14 clicks / 2,858 impressions / CTR 0.49% / 平均順位31.7（突出して弱い）
- municipality Exposure Rate: 872/1,918 = 45.46%
- `population-most` 系が6〜10位付近にいるのにCTR 0〜1%台のページが多数

優先順位は改善提案ドキュメントに従う: **P0 = population-most CTR改善 + ranking内部リンク改善**。

## Current Implementation

- `lib/rankings.ts`: 全16ランキングの定義を1箇所に集約（`RANKingDef`）。`title`/`seoTitle`/`description`/`metaDescription`/`intro`/`faq` はランキングごとに任意設定。`rent-*` と `foreign-ratio-*` は `metaDescription`（1位の実数値を含む動的関数）・`intro`・`faq` を持つが、`population-most` / `population-density` / `population-density-low` はどれも持たず、汎用の `description`（{top1}名のみ置換）のみだった。
- `app/ranking/[metric]/page.tsx`（全国版）の `generateMetadata` は `def.metaDescription` があれば優先して使う。一方 `app/ranking/[metric]/[pref]/page.tsx`（県別版）の `generateMetadata` は**独自の description テンプレートを持ち、`def.metaDescription` を一切参照していなかった**（`rent-*` / `foreign-ratio-*` を含む全ランキング共通の実装ギャップ）。県別版のテンプレートは「{県}の{ランキング名}。1位は{top1}。県内中央値は…。{県}内の{件数}市区町村を…比較できる」の順で、市区町村件数（＝全市区町村を掲載している証拠）が**文末**にあった。
- 内部リンクは両ページとも既に充実している:
  - 全国版: 各順位の自治体名 → `/area/{pref}/{code}`、都道府県セル → `/area/{pref}`、「都道府県別に見る」セクション → `/ranking/{slug}/{pref}`（データのある県のみ）
  - 県別版: 各順位の自治体名 → `/area/{pref}/{code}`、ヘッダに「全国版を見る」「{県}の全自治体」、フッタに「県内のほかのランキング」への相互リンク
- `app/robots.ts` / `app/sitemap.ts` は既に妥当（`/api/` のみ disallow、og画像は許可、canonical・構造化データはページごとに設定済み）。

## Gap Analysis

`page-query.csv` を実際に確認したところ、`population-most` 系（137クエリ行、合計 impressions 264 / clicks 1）の主要クエリは「岡崎市 人口」「大津市 人口」のような**特定1市の人口**を探すもので、実際に着地しているのは**県別ページ**（例: `/ranking/population-most/aichi`）、掲載順位は多くが**3位**（好条件）にも関わらずクリックがほぼゼロだった。

原因は2つ複合していると判断した。

1. `population-most` 系に `metaDescription` が無く、汎用の `description`（「{県}の人口が多い市区町村ランキング。最も人口が多いのは{top1}」）のみだったこと。
2. **より本質的な原因**: 県別ページの description には実は「{県}内{件数}市区町村を…比較できる」という全市区町村を掲載している旨の文言が**既にあった**が、テンプレートの**末尾**にあった。Google検索結果のスニペットは日本語で概ね70文字前後で切れるため、実際の文面（例:「愛知県の人口が多い市区町村ランキング。1位は名古屋市。県内中央値は68,382人。愛知県内54市区町村を…」）では「全市区町村を掲載」の情報が切れて見えず、「県全体のランキングだけ」に見えてクリックされない。県別ページの全ランキング表には実際には全市区町村が掲載されているため、コンテンツ自体は答えを持っている（表示・訴求の問題）。

一方、ranking→area の内部リンクは提案書が懸念していたほど不足しておらず、コード確認の結果すでに十分だった（上記 Current Implementation 参照）。

## Proposed Changes

1. `lib/rankings.ts` に `populationMetaDescription()` を追加し、`foreignMetaDescription` と同じパターン（1位自治体の実数値・基準時点を含む動的description）で `population-most` / `population-density` / `population-density-low` の3件に `metaDescription` を設定する（全国版 `/ranking/{slug}` に反映）。
2. `app/ranking/[metric]/[pref]/page.tsx` の description テンプレートで、「{県}内{件数}市区町村を掲載」の文言を**文頭付近（タイトル直後）**へ移動する。これは特定のランキングに限らない全ランキング共通のテンプレート変更で、`population-most` 以外（`rent-*` / `foreign-ratio-*` 等）の県別ページにも同じ理由で恩恵があり、既存の情報を削らずスニペット内での可視性だけを上げる変更。件数・中央値・1位の情報はすべて維持。
3. ranking→area 内部リンクは既に十分実装済みと判断し、**重複実装しない**（本PRでは変更なし）。

## Files to Change

- `lib/rankings.ts` — `populationMetaDescription()` 追加、3件の `RankingDef` に `metaDescription` を設定
- `app/ranking/[metric]/[pref]/page.tsx` — `generateMetadata` の description テンプレートで市区町村件数の文言を文頭付近へ移動（全ランキング共通）
- `tests/lib/rankings.test.ts` — 新規 `metaDescription` のユニットテスト追加

## Risks

- **SEO**: meta descriptionの変更はGoogleが独自にスニペットを生成することもあり、必ず反映されるとは限らない。既存の高順位（3〜9位）を壊すリスクは低い（title・canonical・構造化データ・順位算出ロジックは変更していない）。
- **UX/表示**: 変更は `<meta name="description">` と OGP/Twitterカードのみで、ページ本文・レイアウトへの影響なし。
- **Regression**: `metaDescription` は既存の型（`(top1: Municipality | null) => string`）に沿っており、`generateMetadata` 側のコードは変更不要。`top1` が `null`（該当自治体なし）の場合のフォールバック文言もテストで確認済み。県別ページのテンプレート変更は**全16ランキング×47都道府県（実質655ページ）に影響**するため、`rent-high` / `foreign-ratio-high` / `waitlist-zero`（membershipList型）の3種でビルド後のHTMLを目視確認し、情報を落とさず順序だけ変わっていることを確認した。

## Test Plan

- `npm run typecheck` / `npm run lint` / `npm run test` / `npm run build`
- 代表URLのメタデータ確認（ビルド後の `.next/server/app/ranking/**.html` を直接grep）:
  - `/ranking/population-most`, `/ranking/population-density`（全国版・新設の `metaDescription` が反映されているか）
  - `/ranking/population-most/hokkaido`, `/ranking/population-most/aichi`, `/ranking/population-density-low/tokyo`（県別版・市区町村件数が文頭付近に来ているか）
  - `/ranking/rent-high/saitama`, `/ranking/foreign-ratio-high/tokyo`, `/ranking/waitlist-zero/saitama`（他ランキングでdescriptionの情報が変わっていない＝順序のみ変更の回帰確認）

## Measurement Plan

次回 `npm run gsc:analyze -- --days 28 --compare` 実行時（実装から最低28日後を推奨）に以下を比較する:

- `population-most` / `population-density` / `population-density-low` 系ページのCTR・clicks（現状: 多くが0〜1%台）
- 平均掲載順位が維持されているか（悪化していないか）
- `opportunities.csv` の `highImpressionLowCtr` に占める population 系の件数の減少

## PR Strategy

1つのPRに収める。変更はランキング定義（`lib/rankings.ts`）+ 県別ページの `generateMetadata`（`app/ranking/[metric]/[pref]/page.tsx`）+ テストのみで、UIコンポーネント（JSX本体）・ルーティング・型定義への変更はない。P1以降（都道府県ハブ化、自治体Exposure Rate改善）は影響範囲・レビュー観点が大きく異なるため別PRに分離する。

## Deferred（次の優先施策）

このPRのスコープ外だが、`page-query.csv` の追加分析で**都道府県ハブページ（`/area/{pref}`）のカニバリゼーション**という、提案書のP1「prefectureページのSEOハブ化」を裏付ける具体的な証拠が見つかったため、次PRの根拠として記録する。

- `/area/{pref}` に着地しているクエリ302件のうち142件が `money`（「{県} 相場」「{県}県 家賃相場」等）、88件が「相場」パターンの `other`。これらは全て30〜40位・クリック0で着地している。
- 一方、本来この検索意図に最適化済みの `/ranking/rent-cheap|high/{pref}` は平均5〜9位で既に走っている（`seoTitle` に「家賃相場」を含む）。
- 対策候補: `/area/{pref}` から `/ranking/rent-cheap|high/{pref}` への内部リンクをアンカーテキスト「{県}の家賃相場ランキングを見る」で強化する、または `/area/{pref}` のtitleから「家賃相場ランキング」の文言を外して重複を避ける。impressions 2,858件がほぼ手つかずのため上振れ余地が大きい。

その他、提案書のP1〜P3（municipality Exposure Rate改善の技術調査、8〜20位/Near Topページ改善、money領域強化、GSC計測改善、livability/safety）は今回未着手。
