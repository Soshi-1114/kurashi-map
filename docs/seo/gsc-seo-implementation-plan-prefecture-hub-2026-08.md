# GSC分析に基づくSEO実装計画: 都道府県ハブページの「相場」カニバリゼーション解消（2026-08）

一次資料: [`kurashimap-gsc-analysis-2026-08-10.md`](./kurashimap-gsc-analysis-2026-08-10.md) §9 /
[`gsc-seo-implementation-plan-2026-08.md`](./gsc-seo-implementation-plan-2026-08.md) Deferred セクション（PR #126 で発見・記録）。
`population-most` 系のCTR改善（PR #126）に続く、GSC分析で確認済みの次の優先施策（P1）。

## Background

`page-query.csv` を確認したところ、`/area/{pref}`（都道府県ハブページ、36ページ）に着地しているクエリ302件のうち142件が `money`（「{県} 相場」「{県}県 家賃相場」等）で、いずれも**30〜40位・クリック0**だった。一方、この検索意図に対して本来最適化済みの `/ranking/rent-cheap|high/{pref}` は**平均5〜9位**ですでに走っている。ページタイプ別集計でも `prefecture`（36ページ）だけが突出して悪い（clicks 14 / impressions 2,858 / CTR 0.49% / 平均順位31.7）。impressions 2,858件のほぼ手つかずの上振れ余地がある。

## Current Implementation

`app/area/[pref]/page.tsx`（都道府県ハブページ）を確認した結果:

- **title**: `"{県}の住みやすさ・家賃相場ランキング｜{count}市区町村を比較｜KurashiMap"` — 「家賃相場ランキング」の文言が `/ranking/rent-cheap|high/{pref}` の title（`"{県}の家賃相場が安い/高い市区町村ランキング｜..."`、`seoTitle` 由来）と完全一致。
- **H2**: 「家賃が安い市区町村ランキング」— `/ranking/rent-cheap/{pref}` の実際のH1（`{県}の{def.title}` = `"{県}の家賃が安い市区町村ランキング"`）とほぼ同一文言。
- ハブページ自体にも家賃が安い上位10自治体（ポディウム+ラダー）を表示しているが、`/ranking/rent-cheap|high/{pref}` への内部リンクが**一切無い**。
- 一方、同じページ内の「人口・人口増減で見る」セクション（H2は「人口・人口増減で見る」という汎用framing、個別ランキングの具体タイトルとは別立て）は、`/ranking/population-most/{pref}` ・ `/ranking/population-growth/{pref}` への「{県}の人口ランキングを見る →」的な内部リンク（`rk-duo-more` クラス）を持つ。**同じファイル内で家賃セクションだけこのパターンが欠けている**、という一貫性の問題。

## Gap Analysis

1. **title/H2の完全一致によるカニバリゼーション**: ハブページの方が内部リンク（トップナビ・サイトマップ等）による認知度が高いため、Googleが「相場」系クエリに対して本来意図の異なる弱いページ（ハブ）を選んでしまい、30〜40位に沈んでいる。
2. **内部リンク欠如**: 人口セクションにはある「ランキングページへのリンク」が家賃セクションには無く、検索エンジン・ユーザーの両方に対して「詳しい家賃ランキングは別ページにある」というシグナルが伝わっていない。

## Proposed Changes

1. `app/area/[pref]/page.tsx` の title から「家賃相場ランキング」を除き、「市区町村データ」に置き換える（`{県}の住みやすさ・市区町村データ｜{count}市区町村を比較｜KurashiMap`）。description も「家賃が安い自治体ランキング」→「家賃・地価が安い自治体」に変更し、同様に「ランキング」語の完全一致を避ける。
2. 家賃セクションのH2を「家賃が安い市区町村ランキング」→「家賃で見る」に変更（人口セクションの「人口・人口増減で見る」という汎用framingパターンに合わせる）。
3. 家賃セクション（ラダーの直後）に、`/ranking/rent-cheap/{pref}` ・ `/ranking/rent-high/{pref}` への内部リンクを追加。人口セクションの `rk-duo-more` パターンをそのまま再利用。リンクを2本並べる必要があるため、`app/league.css` に縦積み用の `.rk-more-links` ラッパを追加（`rk-duo-more` 自体のスタイルは変更しない）。

## Files to Change

- `app/area/[pref]/page.tsx` — title/description、H2、内部リンク追加
- `app/league.css` — `.rk-more-links`（複数の `rk-duo-more` を縦に並べるラッパ）追加

## Risks

- **SEO**: title変更は既存インデックスに影響しうるが、対象ページ（`prefecture` タイプ）はGSCデータ上すでに平均31.7位・CTR0.49%と機能していないため、「壊れているものを壊すリスク」は低いと判断。ハブページ本来の意図（「{県} 住みやすさ」等）を示す語（「住みやすさ」）は維持し、変更は「家賃相場ランキング」の除去のみに限定。
- **UX**: セクション見出しを「家賃が安い市区町村ランキング」→「家賃で見る」に変更するが、直下のリード文（`{prefName}内で民営借家の家賃平均が低い順 上位{count}自治体`）で内容は明示されているため、情報量は落ちない。
- **Regression**: 47都道府県すべてのハブページに影響する変更。ビルド後のHTMLで愛知県（政令市あり）・埼玉県で目視確認し、リンク・見出し・title/descriptionが意図通りであることを確認。

## Test Plan

- `npm run typecheck` / `npm run lint` / `npm run test` / `npm run build`
- ビルド後HTMLで `/area/aichi` の title・description・「家賃で見る」セクションの2本の内部リンク（`/ranking/rent-cheap/aichi`, `/ranking/rent-high/aichi`）を確認
- 既存の `tests/lib/rankings.test.ts` 等、関連テストに影響が無いことを確認（このPRは `app/area/[pref]/page.tsx` と CSS のみの変更で、`lib/rankings.ts` 等のロジックは変更していない）

## Measurement Plan

次回 `npm run gsc:analyze -- --days 28 --compare`（実装から最低28日後）で以下を比較する:

- `/area/{pref}` ページタイプの平均掲載順位・CTR・impressions（現状: 31.7位 / 0.49% / 2,858）
- `/ranking/rent-cheap|high/{pref}` の「{県} 相場」系クエリでの掲載順位・impressions・clicksが改善しているか
- `page-query.csv` で「{県} 相場」系クエリの着地先が `/area/{pref}` から `/ranking/rent-cheap|high/{pref}` へ移っているか

## PR Strategy

1つのPRに収める。`app/area/[pref]/page.tsx` と `app/league.css` のみの変更で、ランキング定義（`lib/rankings.ts`）や他のページには影響しない。PR #126（population-most CTR改善）とは独立して安全にマージ可能。

## Deferred（次の優先施策）

- P1: municipality Exposure Rate（45.46%）の技術調査（sitemap・内部リンク到達性・canonical等）
- P1: 8〜20位/Near Topページの個別改善（57件）
- P2: money領域のランキング強化、GSC計測のbefore/after機能追加
- P3: livability/safetyコンテンツ
