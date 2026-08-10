# KurashiMap SEO改善施策・優先順位
更新日: 2026-08-10

## 1. 目的

`kurashimap-gsc-analysis-2026-08-10.md` のGSC分析結果を基に、
実装可能なSEO改善施策を優先度順に整理する。

優先度は主に以下で判断する。

- 既にGoogle評価を得ているか
- 改善による成果発現までの距離
- 対象Impressions
- サイト全体へ波及するか
- 実装リスク
- 大量ページへスケールできるか

---

# 2. 優先順位サマリー

| Priority | 施策 | 狙い | 主対象 |
|---|---|---|---|
| P0 | `population-most` のCTR改善 | 既存1ページ目露出をクリックへ変換 | ranking |
| P0 | 勝ちランキングの内部リンク強化 | ランキング評価を自治体・都道府県へ循環 | ranking → area |
| P1 | 都道府県ページをSEOハブ化 | 弱いprefectureページの改善＋自治体露出支援 | prefecture |
| P1 | 自治体Exposure Rate改善 | 45.46% → 50〜60%を狙う | municipality |
| P1 | 8〜20位 / Near Topページの改善 | 少ない変更でTOP10入りを狙う | ranking / municipality |
| P2 | money領域をランキング中心に強化 | 1,397 impの潜在需要を取り込む | ranking / map |
| P2 | 自治体ページの統計検索意図対応を強化 | 「自治体 × 指標」のロングテール獲得 | municipality |
| P2 | SEO計測の継続改善 | 実装効果を次回GSCで検証可能にする | tooling |
| P3 | livabilityコンテンツ強化 | 本来テーマの中長期評価を伸ばす | prefecture / municipality |
| P3 | safetyコンテンツ強化 | 将来テーマ | prefecture / municipality |

---

# 3. P0-1: population-most のCTR改善

## 根拠

多数のページが6〜10位付近にいるにもかかわらずCTRが低い。

例:

| URL | Impressions | CTR | Position |
|---|---:|---:|---:|
| `/ranking/population-most/hokkaido` | 392 | 0.51% | 8.8 |
| `/ranking/population-most/aichi` | 339 | 0.29% | 7.3 |
| `/ranking/population-most/ibaraki` | 291 | 0.69% | 8.5 |
| `/ranking/population-most/hyogo` | 273 | 0.73% | 8.6 |
| `/ranking/population-most/kanagawa` | 248 | 0.81% | 8.5 |
| `/ranking/population-most/nagano` | 165 | 0% | 8.5 |
| `/ranking/population-most/hiroshima` | 153 | 0% | 8.4 |

順位を大きく上げなくても、
検索スニペットの改善だけでクリック増加を狙える可能性がある。

## 実装前調査

Claude Codeは必ず、

1. `population-most` のルート・metadata生成処理を特定
2. 現在のtitle / description / H1を確認
3. `page-query.csv` が利用可能なら対象URLの主要クエリを確認
4. 成功している `population-growth` / `foreign-ratio-low` / `rent-high` とmetadata構造を比較
5. Search intentとの差分を整理

すること。

## 改善方針

候補:

- titleの先頭に都道府県名と検索意図の中核語を置く
- 「人口が多い市町村」「人口ランキング」など検索意図を明示
- descriptionで「市区町村別」「順位」「人口」「比較可能」を明示
- H1とtitleの意味を揃える
- コンテンツ更新年が安全に表示可能なら年次を明示
- titleの重複・不自然な量産感を避ける
- 都道府県別ページと全国ページで意図を分離

## 重要

検索クエリを確認できない場合、
特定キーワードを想像してtitleへ詰め込まない。

## 成功指標

変更対象ページ群について、

- CTR改善
- Clicks増
- Position維持または改善
- Impressions維持

を次回GSCで比較。

---

# 4. P0-2: 勝ちランキング → 都道府県・自治体への内部リンク強化

## 根拠

ランキングページは、

- 591 clicks
- 15,373 impressions
- CTR 3.84%
- 平均順位 8.3

で、全検索クリックの約72.6%を占める。

一方、

- prefecture: 平均順位31.7 / CTR 0.49%
- municipality Exposure Rate: 45.46%

である。

## 目的

ランキングページが獲得している検索評価・ユーザー流入を
サイト内の関連ページへ接続する。

## 実装案

ランキングの各行・カードから、

- 自治体名 → 自治体詳細ページ
- 都道府県名 → 都道府県ページ

へ自然な内部リンクを設ける。

さらにページ下部に、

- この都道府県の暮らし情報
- 関連ランキング
- 上位自治体の詳細
- 反対指標ランキング

などの関連導線を検討する。

## 実装原則

- SEO目的だけのリンク羅列にしない
- ユーザーの次の比較行動として自然なUIにする
- 同一URLへの重複リンクを大量生成しない
- アンカーテキストは内容が明確なものにする
- モバイルでリンク密度を上げすぎない

## 成功指標

- rankingページからareaページへの内部遷移
- municipality GSC Exposure Rate
- prefecture impressions / position
- municipality impressions
- クロール可能な内部リンク数

---

# 5. P1-1: 都道府県ページをSEOハブ化

## 根拠

prefectureページ:

- 2,858 impressions
- 14 clicks
- CTR 0.49%
- 平均順位 31.7

Googleは一定の露出を与えているが評価が弱い。

## 仮説

現在の都道府県ページが単なる自治体一覧・入口ページに近い場合、
「都道府県の暮らしを知りたい」という検索意図への情報量・構造が不足している可能性がある。

## 目標構造

例: `/area/fukuoka`

### H1
福岡県の暮らし・住みやすさデータ

### サマリー
- 人口
- 家賃
- 地価
- 子育て
- 災害
- 生活インフラ
- その他実データとして保有している指標

### 都道府県内ランキング
- 人口
- 人口増減
- 家賃
- その他既存ランキング

### 自治体一覧
各自治体詳細へリンク。

### 関連ランキング
対象都道府県に絞った既存rankingページへリンク。

## 実装条件

- 保有していないデータを生成しない
- 都道府県ごとの固有値を使う
- 同一文章の完全コピーを47ページへ展開しない
- 既存のデータジャーナリズム文型・テンプレートがあれば再利用
- UIはトップ/詳細ページの既存デザインシステムに合わせる
- 構造化データを追加する場合はGoogle仕様に適合するものだけ採用

## 成功指標

- prefecture平均順位 31.7 → 改善
- CTR 0.49% → 改善
- prefecture経由自治体ページへの遷移
- 配下自治体Exposure Rate

---

# 6. P1-2: 自治体Exposure Rate改善

## 根拠

- Total: 1,918
- Exposed: 872
- No Impression: 1,046
- Exposure Rate: 45.46%

## 目的

GSCで露出が確認できる自治体を増やす。

## 優先対象

未露出ページをランダムに処理しない。

まず都道府県単位で露出率の低い領域を確認する。

例:

- 青森県: 17.50%
- 鳥取県: 21.05%
- 宮崎県: 23.08%
- 和歌山県: 23.33%
- 秋田県: 24.00%
- 広島県: 25.81%
- 高知県: 26.47%

## 調査項目

- sitemapへの包含
- canonical
- robots / noindex
- server rendering / static generation
- 内部リンク到達性
- orphan pageの有無
- 重複title / description
- ページ固有コンテンツ量
- 都道府県ハブからのリンク
- rankingからのリンク
- HTTP status
- hydration / JS依存で主要本文がクロールしにくくないか

## 改善方針

まず技術的問題を排除し、その後に内部リンクと固有性を改善する。

「未露出 = コンテンツ不足」と最初から決めつけない。

## KPI

- 45.46% → 50%
- 50% → 60%

の段階目標で追う。

---

# 7. P1-3: 8〜20位 / Near Topページ改善

## 根拠

レポート抽出件数:

- 8〜20位: 57ページ
- 4〜10位: 87ページ

代表:

- `/ranking/population-density`: 575 imp / 8 clicks / 10.1位
- `/ranking/population-most`: 514 imp / 4 clicks / 10.7位
- `/ranking/population-most/nagasaki`: 55 imp / 0 clicks / 13.0位

## 改善手順

各ページごとに、

1. 主要page-queryを取得
2. intentを分類
3. title / H1 /本文がintentに答えているか確認
4. 関連内部リンクを確認
5. 上位ページとの差ではなく、自サイト内のWinnerテンプレートとの差をまず比較
6. 小さな変更で改善できるものを優先

## 対応例

- title / description最適化
- 冒頭に検索意図へ直接答える短い説明
- 順位表の意味・基準・データ時点を明確化
- 関連指標へのリンク
- 同地域ランキングへのリンク
- 上位自治体の詳細ページへのリンク

---

# 8. P2-1: money領域をランキング中心に強化

## 根拠

money:

- 197 queries
- 1,397 impressions
- 7 clicks
- CTR 0.50%
- 平均順位 29.7

検索需要はあるが順位がまだ低い。

一方 `rent-high` はWinnerになっており、
ランキング形式との相性が確認できる。

## 方針

新規ページを増やす前に、

- 既存rent系ページ
- map/rent
- 都道府県ページ
- 自治体ページ

の役割と検索意図の重複を確認する。

その上でデータが存在する範囲に限り、

- 家賃が高い/低い
- 地価が高い/低い
- 所得
- 住宅コスト

などの「比較可能な実データ × ランキング」を検討する。

## 禁止

- データがない指標を生成しない
- 同じデータをURLだけ変えて量産しない
- GSCに需要が確認できないテーマを大量展開しない

---

# 9. P2-2: 自治体詳細を「自治体 × 指標」のハブにする

## 目的

自治体ページを「住みやすさ」という広い検索意図だけでなく、
保有データに対応する複数のロングテール検索意図へ適合させる。

## 構成案

ページ内セクションごとに、

- 人口
- 人口推移
- 家賃
- 地価
- 子育て
- 災害リスク
- 生活インフラ

など既存データを明確に構造化。

各セクションに、

- 数値
- 都道府県内比較
- 全国比較
- 短い事実ベース解説
- 関連ランキング

を可能な範囲で付与。

## 注意

既存の1,918自治体向け文型バンク・文章生成ロジックがある場合は、
それを壊さず活用する。

---

# 10. P2-3: GSC計測を改善

次回改善効果を評価できるよう、
GSC分析ツールに以下がなければ追加を検討する。

- URL単位の期間比較
- page-queryの期間比較
- page type別の期間比較
- municipality Exposure Rate推移
- prefecture Exposure Rate推移
- ranking template別集計
- CTR改善対象だけのbefore/after
- 新規URL追加日または変更日との照合
- 「実装対象URLセット」の追跡

可能なら施策ごとに対象URLリストを保存し、
28日後に比較できる形式にする。

---

# 11. P3: livability / safety は中長期施策

## livability

- 237 impressions
- 1 click
- CTR 0.42%
- 平均順位 37.5

## safety

- 79 impressions
- 0 clicks
- 平均順位 49.2

KurashiMapのブランド上は重要だが、
短期SEOの改善効率はpopulation-mostやNear Topより低い。

まずサイト全体の評価・内部リンク・都道府県ハブを強化した後に、
検索意図別のコンテンツ設計を行う。

---

# 12. 推奨する実装フェーズ

## Phase A: 低リスク・即効性

1. `population-most` metadata / H1の調査
2. page-queryとの照合
3. CTR改善
4. ranking内の自治体・都道府県リンク確認
5. 不足している自然な内部リンク追加

### 原則
最初のPRはこの範囲に限定してもよい。

---

## Phase B: 構造改善

1. prefectureページ現状調査
2. SEOハブ化
3. ranking → prefecture → municipality のリンク構造整備
4. 低Exposure県を優先して到達性確認

Phase Aと変更範囲が大きく異なる場合、別PRに分離する。

---

## Phase C: コンテンツ拡張

1. moneyの既存検索需要を分析
2. 既存データで追加可能なランキング候補を選定
3. 自治体詳細の各統計セクション強化
4. livability / safetyを中長期で改善

GSC需要を確認したものから実装する。

---

# 13. PR分割方針

一つの巨大PRにしない。

推奨:

### PR 1
`seo: improve ranking CTR and internal linking`

- population-most metadata
- ranking関連内部リンク
- 必要なテスト

### PR 2
`seo: strengthen prefecture pages as regional hubs`

- prefecture SEOハブ
- municipality導線
- 関連ranking導線

### PR 3
`seo: improve GSC exposure and measurement`

- orphan / sitemap等の技術修正
- GSC分析のbefore/after計測

コンテンツ追加は別PRとすることを推奨。

---

# 14. 実装時のガードレール

- 現在成長しているrankingテンプレートを全面刷新しない
- GSCの「未露出」を「未index」と呼ばない
- SEOのためだけに不自然な文章を増やさない
- キーワードスタッフィングをしない
- 根拠のない「おすすめ」「住みやすい」等を生成しない
- データの時点・定義を損なわない
- canonicalを不用意に変更しない
- URLを変更しない
- 既存のstructured dataを壊さない
- CLS/LCP等を悪化させるUI変更を避ける
- モバイルUXを維持する
- accessibilityを維持する
- 既存テスト・lint・buildを通す

---

# 15. 実装後に確認する指標

最低28日程度の比較窓を確保したうえで、

## population-most
- CTR
- Clicks
- Impressions
- Position

## ranking
- Clicks
- Impressions
- internal navigation

## prefecture
- Position
- CTR
- Impressions

## municipality
- Exposed count
- Exposure Rate
- No Impression count

を再計測する。

最重要なのは「SEO施策を入れた」ことではなく、
**GSCの実測値で仮説が正しかったか判断できる状態を残すこと**。
