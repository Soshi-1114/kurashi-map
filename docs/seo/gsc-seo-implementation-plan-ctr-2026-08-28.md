# GSC/GA4分析（2026-08-27）に基づく実装計画: CTR改善・地図導線・将来人口押し上げ

一次資料: `npm run gsc:analyze -- --days 28 --compare` および `--days 14 --since=2026-08-11`
（2026-08-27実行、データは確定済みの2026-08-24分まで。レポートdirは .gitignore のため再現は同コマンド）。
GA4 は Data API（サービスアカウント経由・2026-08-27にアクセス確立）で取得。

## Background

直近28日: 1,103 clicks / 36,620 impressions / 平均掲載順位 10.2（前28日比 clicks +91% / impressions +122%）。
GA4: activeUsers 1,662（+76%）・エンゲージ率 75%・平均セッション 310秒。8/11 リリース（IPSS将来人口ほか）の
前後14日比較で clicks 428→676、伸びの主役は population-decline 県別と pr-126 の description 改善セット。

残っている課題は3つ:

1. **population-most / population-density（全国版）の CTR が 1% 前後**
   （1,537imp/CTR1.11%/9.0位・1,257imp/CTR0.95%/8.7位）。県別 population-most も CTR 0〜1.8% が多数。
2. **/ranking/future-population-resilient が 129imp / 0click / 11.0位**（2ページ目）。
3. **GA4 の select_municipality（地図で自治体を選ぶ操作）が 437→374 と微減**。
   ユーザー+76%に対し地図操作が増えておらず、ランキング流入が「読んで帰る」型に留まっている。

## Gap Analysis（page-query.csv の実クエリから）

### 1. population 系全国版: 「答え」を探す質問型クエリに title が答えていない

`/ranking/population-most` の最大クエリは
**「日本の市として 人口が最も多いのはどこ」305imp / 0click / 10.8位**（質問型・答え待ち）。
`/ranking/population-density` も「日本一人口密度が高い市」39imp、「日本で一番人口密度が高い市」12imp、
「日本一人口密度が高い市町村」12imp など **「日本一」系がゼロクリック**。
現 title「人口が多い市区町村ランキング【2025年国勢調査】」には答え（1位の自治体名）も「日本一」の語もない。
pr-126 で description には1位実数値を入れたが、title 側は未着手だった。

なお `population-density-low`（日本一低い側）は既に CTR 6.5%（48click/743imp）で好調。
「答えが特殊で面白い（=歌志内市等）」ページはクリックされており、答え先出しの傍証になっている。

### 2. population-most 県別: 連続語「人口ランキング」が title に無い

クエリは「兵庫県 市町村 人口ランキング」「奈良県 人口ランキング」「市町村人口ランキング 2025」の形。
現 title「{県}の人口が多い市区町村ランキング…」は 人口/ランキング を含むが**連続語「人口ランキング」を含まない**。

### 3. future-population-resilient: title に「2050年」は既にある（→原因は別）

seoTitle「2050年も人口を維持する見込みの市区町村ランキング【将来推計人口】」に 2050年 は入っている。
付いているクエリ「2050年 人口 ランキング 市町村」（6imp/9.7位）「2050 年 都市 人口 ランキング」（3imp/5.7位）
に対し、**連続語「人口ランキング」が無い**こと・**11位（2ページ目）**・公開3週間の新しさが複合要因。
「2050年の都道府県予測人口ランキング」（計22imp/25位超）は都道府県レベルの意図で、
市区町村ランキングでは答えられないため今回は対象外（将来: 県別集計コンテンツの検討余地）。

### 4. 地図導線: ランキングページから地図への入口が実質フッターのみ

ランキング行→ `/area` 詳細、フッター「地図に戻る」、foreign 系のみ `/map/foreign-ratio` への
ハードコードリンク（`app/ranking/[metric]/page.tsx`）がある状態。
`lib/mapDeepLink.ts` の `mapHrefForCode(code, path)` は指標別ハブでも動き、
ディープリンク選択は `select_municipality`（method: "link"）を発火するため、導線追加＝そのまま計測可能。

## Proposed Changes

### PR-A: population 系 title の「答え先出し」（優先度: 高）

- `lib/rankings.ts` の `RankingDef` に `seoTitleFn?: (top1: Municipality | null) => string` を追加
  （`seoTitle` より優先。`generateMetadata` は `top[0]` を取得済みなので接続は小変更）。
  - `population-most`: `人口が多い市区町村ランキング｜日本一は{1位}` →
    実タイトル例「人口が多い市区町村ランキング｜日本一は横浜市【2025年国勢調査】｜KurashiMap」
  - `population-density`: `人口密度が高い市区町村ランキング｜日本一は{1位}`
  - 1位名はデータ更新に自動追随（実データのみ・honesty 方針に適合）。
- `RankingDef` に `prefSeoTitle?: string` を追加し、県別 `generateMetadata` で
  `${pref.nameJa}の${def.prefSeoTitle ?? def.seoTitle ?? def.title}` とする。
  - `population-most` のみ設定: 例「市区町村 人口ランキング（人口が多い順）」→
    「兵庫県の市区町村 人口ランキング（人口が多い順）【2025年国勢調査】｜市区町村を比較｜KurashiMap」
- 対象はこの2系統に限定し、他ランキングは対照群として据え置く（順位7〜9位で安定しているものを
  一斉に触らない。title 変更には順位変動リスクがあるため）。
- `tests/lib/rankings.test.ts` に seoTitleFn / prefSeoTitle のユニットテスト追加。

### PR-B: ランキング→地図の共通CTA（優先度: 中）

- ランキング slug → 地図ハブの対応表を `lib/siteNav.ts`（`MAP_HUBS` の隣）に追加:
  - rent-cheap / rent-high → `/map/rent`
  - land-price-high / land-price-low → `/map/land-price`
  - population-growth / population-decline → `/map/population-trend`
  - future-population-decline / future-population-resilient → `/map/future-population`
  - foreign-ratio-high / foreign-ratio-low → `/map/foreign-ratio`
  - （population-most / density / vacancy / waitlist は対応ハブが無いため出さない）
- 全国版・県別版ランキングの lead 直下に「🗺 {ハブ名}で全国を地図で見る →」を共通表示し、
  foreign 系の既存ハードコードリンクを置換。
- 任意拡張: ポディウム上位3自治体カードに `mapHrefForCode(code, ハブpath)` の
  「地図で見る」ミニリンク。**注意**: カード全体が `/area` への `<Link>` のため、
  ネストせずカード外側 or 別要素として置く（a要素ネスト不可）。
- 効果測定は GA4 `select_municipality` の `method="link"` 比率と絶対数。

### PR-C: future-population-resilient の押し上げ（優先度: 中）

- seoTitle を「2050年の将来人口ランキング｜人口を維持する見込みの市区町村」へ変更
  （連続語「人口ランキング」を作り、2050年を文頭維持）。decline 側
  「2050年の将来推計人口 減少率ランキング」は既に良い形なので据え置き。
- 内部リンク: 今回の勝ち頭 population-decline（全国＋県別）の note/lead に
  「2050年の将来推計はこちら」の文中リンクを1行追加（全国→全国、県別→同県の future 県別）。
  リンク元が現在最も強いページ群なので、2ページ目からの押し上げに最も効く。

### 測定（全PR共通）

- `docs/seo/url-sets.json` に新セットを追加（since はデプロイ翌日、実デプロイ日ずれたら修正）:
  - `pr-XXX-population-answer-titles`（/ranking/population-most, /ranking/population-density）
  - `pr-XXX-population-most-pref-titles`（/ranking/population-most/{47県}）
  - `pr-XXX-future-resilient-title`（/ranking/future-population-resilient）
  - 地図CTAは GSC でなく GA4 側（select_municipality method=link）で測る。
- デプロイは手動（deploy-preview.yml）。マージ後デプロイ→ IndexNow →
  **2026-09 中旬に `npm run gsc:analyze -- --days 14 --since={デプロイ日}` で前後比較**。

## Files to Change

| PR | ファイル | 変更 |
| --- | --- | --- |
| A | `lib/rankings.ts` | `seoTitleFn` / `prefSeoTitle` 型追加＋population-most / population-density の2定義に設定 |
| A | `app/ranking/[metric]/page.tsx` | title 組み立てで `seoTitleFn(top[0])` を優先 |
| A | `app/ranking/[metric]/[pref]/page.tsx` | title 組み立てで `prefSeoTitle` を優先 |
| A | `tests/lib/rankings.test.ts` | 追加分のテスト |
| A/C | `docs/seo/url-sets.json` | 測定用セット追加 |
| B | `lib/siteNav.ts` | slug→地図ハブ対応表 |
| B | `app/ranking/[metric]/page.tsx`・`[pref]/page.tsx` | 共通CTA挿入・foreign系ハードコード置換 |
| C | `lib/rankings.ts` | future-population-resilient の seoTitle 変更、population-decline の note にリンク文 |

## リスクと判断メモ

- title 変更は順位変動リスクを伴う。対象を「表示は多いのに CTR ~1%」の population-most /
  population-density（高い側）に限定し、好調な population-density-low・population-decline 系は触らない。
- 県ハブ（順位33.9）と /denki（表示9）は 8/11〜8/18 の施策の浸透待ちで、今回は追加施策なし。
  9月中旬の再計測で判断。
- 「2050年の都道府県予測人口ランキング」需要（都道府県レベル）は市区町村サイトの守備範囲外として見送り。
