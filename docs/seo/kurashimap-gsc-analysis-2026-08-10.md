# KurashiMap GSC分析結果
更新日: 2026-08-10

## 1. このドキュメントの目的

Google Search Console（GSC）から取得した KurashiMap の検索パフォーマンスを整理し、
Claude Code が今後のSEO実装判断に利用できる状態にする。

このドキュメントは「観測された事実」と「そこからの解釈」を中心にまとめる。
具体的な改善施策・優先順位は別ファイル
`kurashimap-seo-improvement-priorities-2026-08-10.md`
を参照すること。

---

## 2. 分析対象

- Site: `sc-domain:kurashimap.jp`
- Search type: `web`
- 対象期間: 2026-07-11 〜 2026-08-07
- 比較対象: 前28日
- 自治体詳細ページ総数: 1,918
- 直近3日はGSCデータ未確定のため除外
- 元データ:
  - `analysis.json`
  - `summary.md`
  - `pages.csv`
  - `queries.csv`
  - `page-query.csv`
  - `municipalities.csv`
  - `prefectures.csv`
  - `opportunities.csv`
  - `no-impression-pages.csv`

### データ上の注意

GSC Search Analytics API は、低頻度クエリの匿名化、上位データ中心の抽出、返却上限などがある。
したがって以下に注意する。

- GSCに出ていないページ = インデックス未登録、とは断定しない
- 本文中の「未露出」は「対象期間中にGSCで検索露出を確認できなかった」という意味
- 平均掲載順位は複数クエリ・複数検索面の平均であり、単独キーワードの順位ではない
- 期間比較はページ単位。クエリ単位の期間比較ではない

---

# 3. エグゼクティブサマリー

KurashiMap のSEOは、対象期間で明確な成長局面にある。

直近28日では、

- Clicks: 814
- Impressions: 23,900
- CTR: 3.41%
- 平均掲載順位: 11.1

前期間と比較すると、

- Clicks: 90 → 814
- Impressions: 4,200 → 23,900
- CTR: 2.14% → 3.41%
- 平均掲載順位: 17.4 → 11.1

となっており、検索露出・流入・順位・CTRがすべて改善している。

さらに直近7日でも、

- Clicks: 156 → 227（+45.5%）
- Impressions: 5,531 → 7,123（+28.8%）
- CTR: 2.82% → 3.19%
- 平均掲載順位: 11.5 → 11.4

となっている。

したがって、現在は大規模なSEO方針変更を行う局面ではなく、
**Googleが既に評価し始めているページ構造・テーマを増幅する局面**
と判断する。

---

# 4. サイト全体の成長

## 4.1 28日比較

| 指標 | 前期間 | 直近28日 | 評価 |
|---|---:|---:|---|
| Clicks | 90 | 814 | 大幅増 |
| Impressions | 4,200 | 23,900 | 大幅増 |
| CTR | 2.14% | 3.41% | 改善 |
| 平均掲載順位 | 17.4 | 11.1 | 大幅改善 |

固定28日比較では Clicks +803.3%、Impressions +474.3%。

## 4.2 直近7日

| 指標 | 前7日 | 直近7日 | 変化 |
|---|---:|---:|---:|
| Clicks | 156 | 227 | +45.5% |
| Impressions | 5,531 | 7,123 | +28.8% |
| CTR | 2.82% | 3.19% | +0.37pt |
| 平均掲載順位 | 11.5 | 11.4 | ほぼ横ばい |

順位が大きく変わらない状態でもImpressionsが伸びている。
これは既存キーワードの順位上昇だけでなく、
**露出するページ・検索クエリの範囲が広がっている可能性**
を示す。

8月7日時点の7日移動平均は、

- Clicks: 32.43 / day
- Impressions: 1,017.57 / day

まで成長している。

---

# 5. ページタイプ別の評価

| Page Type | Pages | Clicks | Impressions | CTR | Avg Position |
|---|---:|---:|---:|---:|---:|
| ranking | 432 | 591 | 15,373 | 3.84% | 8.3 |
| municipality | 872 | 183 | 5,404 | 3.39% | 8.1 |
| map | 4 | 17 | 204 | 8.33% | 13.5 |
| prefecture | 36 | 14 | 2,858 | 0.49% | 31.7 |
| top | 1 | 9 | 32 | 28.13% | 2.6 |
| about | 1 | 0 | 29 | 0% | 2.1 |

## 5.1 最重要ポイント: ranking が現在のSEO流入エンジン

ランキングページは、

- 591 clicks
- 15,373 impressions
- CTR 3.84%
- 平均順位 8.3

であり、全814クリックの約72.6%を占める。

現時点では、
**「自治体の暮らし情報サイト」そのものよりも、「自治体統計・ランキング」に対してGoogle評価が先行している**
と解釈できる。

特に伸びているテーマは、

- population-growth
- population-density
- foreign-ratio
- rent

など。

## 5.2 municipality は順位自体は悪くない

自治体詳細ページは、

- 183 clicks
- 5,404 impressions
- CTR 3.39%
- 平均順位 8.1

である。

露出済みページに限れば平均順位は1ページ目相当で、
課題は「露出した後の順位」だけではなく、
**まだ露出していない自治体ページが多いこと**
にある。

## 5.3 prefecture は明確な弱点

都道府県ページは、

- 14 clicks
- 2,858 impressions
- CTR 0.49%
- 平均順位 31.7

である。

Impressionsは存在するが、自治体・ランキングページと比較して順位とCTRが大幅に弱い。

これは、
**都道府県ページが検索意図に十分応えられるSEOランディングページになっていない可能性**
を示す。

---

# 6. ランキングページの勝ちパターン

主要Winner:

| URL | Clicks | Prev Clicks | Δ Clicks | Impressions | Position |
|---|---:|---:|---:|---:|---:|
| `/ranking/population-growth/nagano` | 31 | 1 | +30 | 253 | 6.7 |
| `/ranking/foreign-ratio-low` | 23 | 0 | +23 | 214 | 5.4 |
| `/ranking/foreign-ratio-high` | 23 | 4 | +19 | 488 | 7.9 |
| `/ranking/rent-high` | 23 | 4 | +19 | 202 | 5.5 |
| `/ranking/population-density-low` | 16 | 0 | +16 | 425 | 8.9 |
| `/ranking/population-growth/saitama` | 15 | 0 | +15 | 276 | 8.7 |

この結果から、

**地域名 × 統計指標 × 順位・比較**

という検索意図との相性が良い。

特に `population-growth` は都道府県別派生ページでも成果が出ている。

---

# 7. 最大のCTR改善機会: population-most

`population-most` 系ページは検索順位が6〜10位前後に入っているにもかかわらず、
CTRが非常に低いページが多数ある。

代表例:

| URL | Impressions | Clicks | CTR | Position |
|---|---:|---:|---:|---:|
| `/ranking/population-most/hokkaido` | 392 | 2 | 0.51% | 8.8 |
| `/ranking/population-most/aichi` | 339 | 1 | 0.29% | 7.3 |
| `/ranking/population-most/ibaraki` | 291 | 2 | 0.69% | 8.5 |
| `/ranking/population-most/hyogo` | 273 | 2 | 0.73% | 8.6 |
| `/ranking/population-most/kanagawa` | 248 | 2 | 0.81% | 8.5 |
| `/ranking/population-most/saitama` | 236 | 5 | 2.12% | 8.4 |
| `/ranking/population-most/fukuoka` | 234 | 3 | 1.28% | 8.1 |
| `/ranking/population-most/shiga` | 227 | 3 | 1.32% | 6.4 |
| `/ranking/population-most/chiba` | 179 | 1 | 0.56% | 9.3 |
| `/ranking/population-most/nagano` | 165 | 0 | 0% | 8.5 |
| `/ranking/population-most/hiroshima` | 153 | 0 | 0% | 8.4 |
| `/ranking/population-most/miyazaki` | 123 | 0 | 0% | 9.7 |
| `/ranking/population-most/mie` | 122 | 0 | 0% | 8.7 |
| `/ranking/population-most/yamaguchi` | 113 | 0 | 0% | 8.5 |
| `/ranking/population-most/kumamoto` | 112 | 0 | 0% | 8.6 |

Googleは既に多くのページを1ページ目付近へ出している。

よってここでは新規コンテンツ追加より先に、

- title
- meta description
- H1
- 検索結果上で伝わるページ価値
- 実検索クエリとページ文言の一致

を確認する価値が高い。

### 注意

ページ単位の低CTRだけでは「なぜクリックされないか」は断定できない。
実装前に `page-query.csv` で該当URLの検索クエリ内訳を確認すること。

---

# 8. 自治体ページの状況

## 8.1 露出率

全1,918自治体のうち、

- GSC露出あり: 872
- GSC未露出: 1,046
- Exposure Rate: 45.46%

つまり54.54%は、対象期間中に検索Impressionが確認できていない。

自治体ページについては短期的な主要KPIを
**平均順位だけではなく GSC Exposure Rate**
とするのが妥当。

## 8.2 ステータス内訳

- strong: 0
- growing: 53
- opportunity: 19
- lowCtr: 25
- weak: 597
- noImpression: 1,046
- other: 178

## 8.3 上位例

| Municipality | Prefecture | Clicks | Impressions | CTR | Position |
|---|---|---:|---:|---:|---:|
| 足立区 | 東京都 | 8 | 209 | 3.83% | 7.8 |
| 神戸市 | 兵庫県 | 3 | 136 | 2.21% | 9.3 |
| 京都市 | 京都府 | 2 | 77 | 2.60% | 10.5 |
| 飯塚市 | 福岡県 | 2 | 8 | 25.00% | 4.4 |

一部自治体では検索評価を獲得できているため、
ページテンプレート自体が全面的に失敗しているとは言いにくい。

課題は、

1. 自治体ごとの検索需要差
2. 内部リンク強度
3. ページ独自性
4. 検索意図との一致
5. Googleによるクロール・評価の進行差

を切り分けること。

---

# 9. 都道府県別の自治体露出格差

比較的Exposure Rateが高い例:

- 東京都: 67.74%
- 大分県: 66.67%
- 静岡県: 65.85%
- 神奈川県: 63.93%
- 埼玉県: 61.64%
- 大阪府: 59.46%

低い例:

- 青森県: 17.50%
- 鳥取県: 21.05%
- 宮崎県: 23.08%
- 和歌山県: 23.33%
- 秋田県: 24.00%
- 広島県: 25.81%
- 高知県: 26.47%

未露出1,046ページを個別に修正するよりも、
**都道府県単位のハブ構造・内部リンク構造を改善し、その配下自治体へ評価を流す**
方がスケールしやすい可能性がある。

---

# 10. クエリカテゴリ

| Category | Queries | Clicks | Impressions | CTR | Position |
|---|---:|---:|---:|---:|---:|
| population | 249 | 21 | 673 | 3.12% | 18.9 |
| other | 221 | 8 | 1,083 | 0.74% | 28.9 |
| money | 197 | 7 | 1,397 | 0.50% | 29.7 |
| municipality | 261 | 5 | 1,027 | 0.49% | 16.2 |
| child | 6 | 3 | 23 | 13.04% | 5.2 |
| livability | 25 | 1 | 237 | 0.42% | 37.5 |
| safety | 17 | 0 | 79 | 0% | 49.2 |

## 10.1 population

最も成果が確認できているテーマ。
ランキングページの勝ち筋とも一致する。

## 10.2 money

1,397 impressionsと検索露出は大きい一方、

- CTR 0.50%
- 平均順位 29.7

である。

需要は確認できているが、ページ評価または検索意図一致がまだ弱い。
`rent` 系ランキングが既に成果を出しているため、次の成長候補。

## 10.3 livability

KurashiMapのサービスコンセプトに近いが、

- 237 impressions
- 1 click
- CTR 0.42%
- 平均順位 37.5

と現時点では弱い。

## 10.4 safety

- 79 impressions
- 0 click
- 平均順位 49.2

短期的なSEO成果を期待するテーマとしては優先順位が低い。

## 10.5 child

母数は非常に小さいが、

- 23 impressions
- 3 clicks
- CTR 13.04%
- 平均順位 5.2

と反応が良い。

ただしクエリ数6件のため、
このデータだけで大規模展開の判断はしない。

---

# 11. Opportunity件数

レポート上では、

- title / description 改善候補: 29件
- 8〜20位のコンテンツ・内部リンク改善候補: 57件
- 4〜10位のNear Top候補: 87件
- GSC未露出自治体: 1,046件
- 順位急落ページ: 1件

が抽出されている。

特に8〜20位では、

- `/ranking/population-density`: 575 imp / 8 clicks / position 10.1
- `/ranking/population-most`: 514 imp / 4 clicks / position 10.7
- `/ranking/population-most/nagasaki`: 55 imp / 0 clicks / position 13.0

など、比較的小さな改善で流入増を狙える候補が存在する。

---

# 12. 現在のSEO構造に対する解釈

現時点のデータから、KurashiMap は次の順にGoogle評価を獲得していると考えられる。

1. 自治体統計・ランキング
2. 個別自治体
3. 地図
4. 都道府県ハブ
5. 「住みやすさ」「治安」など総合的・競争の強いテーマ

特に重要なのは、
ランキングページを単独の流入ページとして扱うだけでなく、

`ランキング → 都道府県 → 自治体`

の内部リンク導線を形成し、
ランキングが獲得した検索評価とユーザー流入を
サイト全体へ循環させることである。

これはGSCから直接証明できる因果関係ではないが、
現在のページタイプ別パフォーマンスに基づく合理的なSEO仮説である。

---

# 13. 今後追跡すべきKPI

## Site
- Clicks
- Impressions
- CTR
- Average Position
- 7日移動平均Clicks
- 7日移動平均Impressions

## Ranking
- Ranking page clicks
- Ranking page impressions
- CTR
- 4〜10位ページ数
- 8〜20位ページ数
- 新規露出ページ数

## Municipality
- GSC Exposure Rate
- Exposed municipality count
- No-impression municipality count
- Weak → Growingへの遷移数
- Municipality clicks / impressions

### Exposure Rate目標イメージ

- 現在: 45.46%
- 第1目標: 50%
- 第2目標: 60%
- 中期目標: 70%以上

※目標値は運用上の目安であり、GSCデータだけから導出された必達値ではない。

## Prefecture
- Prefecture平均順位
- Prefecture CTR
- 各都道府県配下自治体のExposure Rate
- Prefecture → Municipality 内部リンククリック

## Theme
- population
- money
- municipality
- livability
- safety
- child

のカテゴリ別推移。

---

# 14. 現時点で避けるべき判断

1. 住みやすさ領域の順位が低いことを理由に、サイト全体の方向性を変更しない
2. 未露出1,046ページを「インデックスされていない」と断定しない
3. 低CTRページをクエリ確認なしで一括title変更しない
4. 勝っているランキングテンプレートを大規模に作り替えない
5. ページ大量追加を最優先にしない
6. GSC平均順位だけでコンテンツ品質を判断しない

---

# 15. 最終評価

KurashiMapはSEO初期段階として良好な成長を示している。

最大の強みは、
**ランキングページで既に検索1ページ目級の評価を得られていること**。

最大の短期Opportunityは、
**既に1ページ目付近にいる `population-most` 系のCTR改善**。

最大の中期課題は、
**自治体ページのGSC Exposure Rate 45.46%を引き上げること**。

構造上の最大課題は、
**都道府県ページが2,858 impressionsを持ちながら平均31.7位・CTR 0.49%に留まっていること**。

今後は、

`検索需要のあるランキング`
→ `都道府県ハブ`
→ `自治体詳細`
→ `関連ランキング`

という回遊・内部リンク構造を強化しつつ、
人口系で得た勝ちパターンをmoneyなど隣接テーマへ展開する方針が有力である。
