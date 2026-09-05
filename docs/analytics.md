# 計測（GA4）運用ガイド

KurashiMap は Google Analytics 4（gtag.js）でページビューに加えて、**Core Web Vitals** と
**主要操作イベント**を送信しています。このドキュメントは、送信している中身と、GA4 管理画面での
設定・分析手順をまとめたものです。

- 測定ID: `G-HL76L0RDWK`（`app/layout.tsx`）
- gtag 本体の読み込み: `app/layout.tsx`（`afterInteractive`）
- 送信ヘルパー: [`lib/analytics.ts`](../lib/analytics.ts)
- Web Vitals 送信: [`components/WebVitals.tsx`](../components/WebVitals.tsx)（`app/layout.tsx` に常設）

> **方針**: 計測も honesty 方針に準じ「実際に起きたこと」だけを送ります。推測値や水増しはしません。
> 送信ヘルパーは `window.gtag` 未ロード時・SSR 時に **no-op** になるよう実装しています。

---

## 1. 送信しているイベント一覧

| イベント名 | 発火タイミング | 送信箇所 |
|---|---|---|
| `web_vitals` | 各 Web Vital が確定した時（LCP/FCP/TTFB は表示直後、INP/CLS は離脱前後） | `components/WebVitals.tsx` |
| `select_municipality` | 自治体を選択した時（地図クリック／検索） | `components/MapView.tsx` |
| `change_metric` | 塗り分け指標を切り替えた時 | `components/MapView.tsx` |
| `apply_filter` | 条件フィルタ（家賃上限／地価上限／浸水深上限／空き家率上限／2050年人口）を変更した時 | `components/MapView.tsx` |
| `select_section` | 自治体詳細ページの目次（セクションナビ）で移動した時 | `components/area/SectionNav.tsx` |
| `support_link_click` | 支援（投げ銭）リンクをクリックした時 | `components/area/SupportBanner.tsx` |
| `furusato_link_click` | ふるさと納税リンクをクリックした時 | `components/area/FurusatoLink.tsx` |
| `kasai_link_impression` | 火災保険導線が50%視認された時（1要素1回） | `components/monetization/KasaiLink.tsx` |
| `kasai_link_click` | 火災保険の外部リンクをクリックした時（キーイベント候補） | `components/monetization/KasaiLink.tsx` |
| `tool_entry` | 他ページから道具のページ（比較・診断）に着地した時（`?from=` があるときのみ1回） | `lib/useToolEntry.ts`（`CompareClient` / `ShindanClient` から呼ぶ） |
| `shindan_run` | 街診断の重み・地方の組み合わせを変更した時 | `components/shindan/ShindanClient.tsx` |
| `shindan_result_click` | 診断結果から自治体詳細へ遷移した時 | `components/shindan/ShindanClient.tsx` |
| `denki_simulate` | 電気代シミュレーターの入力を確定した時（連続入力は 1s debounce） | `components/denki/DenkiSimulator.tsx` |
| `denki_offer_impression` | 電気代の比較結果リストを表示した時（エリアごとに1回。掲載オファー0件の間は送らない） | `components/denki/DenkiSimulator.tsx` |
| `denki_offer_click` | 電気プランの外部リンクをクリックした時（キーイベント候補） | `components/denki/DenkiSimulator.tsx` |

※ 自治体詳細ページの電気代導線（`DenkiTeaser`、サーバコンポーネント）は専用イベントを持たない。
流入は `/denki` の page_view（`?code=` 付き）と `denki_simulate` の `municipality_code` で見る。

### パラメータ

| イベント | パラメータ | 型 | 値の例 | 備考 |
|---|---|---|---|---|
| `web_vitals` | `metric_name` | 文字列 | `LCP` `INP` `CLS` `FCP` `TTFB` | |
| | `metric_rating` | 文字列 | `good` `needs-improvement` `poor` | しきい値判定を GA4 で再計算せず使える |
| | `metric_id` | 文字列 | 計測ごとの一意ID | 重複排除・デバッグ用。レポート登録は不要 |
| | `value` | 数値 | ms（**CLS のみ ×1000 したスコア**） | CLS は無次元のため桁を保つ目的で 1000 倍 |
| | `non_interaction` | 真偽 | `true` | ※後述の注記参照 |
| `select_municipality` | `municipality_code` | 文字列 | `13104` | 自治体コード（5桁） |
| | `method` | 文字列 | `map` `search` | 選択の導線 |
| `change_metric` | `metric_key` | 文字列 | `rent` `landPrice` `populationTrend` | |
| `select_section` | `section` | 文字列 | `overview` `data` `compare` `ranking` `details` | 移動先のセクション |
| | `municipality_code` | 文字列 | `40220` | 自治体コード（5桁） |
| `apply_filter` | `rent_max` | 数値 | `0` `50000` `60000` `70000` | 家賃上限（円/月）。`0`=条件なし |
| | `land_max` | 数値 | `0` `50000` `100000` `200000` | 地価上限（円/㎡）。`0`=条件なし |
| | `flood_max` | 数値 | `-1` `0` `2` `3` | 浸水深ランク上限（`-1`=条件なし, `0`=浸水なし限定, `2`=〜3m, `3`=〜5m） |
| | `vacancy_max` | 数値 | `0` `10` `15` `20` | 空き家率上限（%）。`0`=条件なし |
| | `aging_max` | 数値 | `0` `30` `35` `40` | 高齢化率上限（%）。`0`=条件なし |
| | `future_min` | 数値 | `-999` `-20` `-10` `0` | 2050年推計人口の増減率の下限（%）。`-999`=条件なし, `0`=増加見込み限定 |
| `support_link_click` | `municipality_code` | 文字列 | `13101` | 表示中の自治体コード |
| | `municipality_name` | 文字列 | `千代田区` | |
| `furusato_link_click` | `municipality_code` | 文字列 | `13101` | 表示中の自治体コード |
| | `placement` | 文字列 | `area` / `ranking` / `ranking-top` / `future-view` | 掲載面。`ranking-top`=ランキング順位台の直後（1位自治体）、`ranking`=ページ最下部の帯、`future-view`=詳細ページの将来人口カード内 |
| `kasai_link_impression` / `kasai_link_click` | `placement` | 文字列 | `area` / `hazard-map` / `map-panel` / `shindan` | 掲載面（面ごとのCTR分析用）。`area`=詳細ページ災害カード直下、`map-panel`=地図の自治体パネル（災害オーバーレイ表示中のみ）、`shindan`=診断で災害重視時の結果下 |
| `kasai_link_impression` / `kasai_link_click` | `municipality_code` | 文字列 | `13101` | 表示中の自治体コード（自治体面のみ） |
| | `municipality_name` | 文字列 | `千代田区` | 寄付先名（行政区は親の政令市名） |
| `tool_entry` | `tool` | 文字列 | `compare` / `shindan` | 着地した道具のページ |
| | `tool_source` | 文字列 | `ranking` / `ranking_row` / `ranking_top3` / `pref_ranking` / `pref_ranking_top3` / `prefecture_ranking` / `pref_hub` | 送り元の導線。語彙は `lib/siteNav.ts` の `ToolSource` 型で閉じている（`pref_ranking`=県別ランキング、`prefecture_ranking`=都道府県ランキング）。**`source` という名前は使わない** — GA4 が `source`/`medium`/`campaign` をアトリビューションに使うため、同名で送ると流入元の集計を汚す |
| | `municipality_codes` | 文字列 | `13101,27100` | 比較のみ。着地時に選択済みの自治体コード |
| | `count` | 数値 | `3` | 比較のみ。同上の件数 |
| `shindan_run` | `weights` | 文字列 | `210120` | SHINDAN_AXES 順の重み6桁（0-2） |
| | `regions` | 文字列 | `kanto,tokai` | 選択した地方（空=全国） |
| | `result_count` | 数値 | `312` | 条件に該当した自治体数 |
| `shindan_result_click` | `municipality_code` | 文字列 | `11203` | 遷移先の自治体コード |
| | `position` | 数値 | `0` | 結果リスト内の順位（0始まり） |
| `denki_simulate` | `area` | 文字列 | `tokyo` `kansai` | 供給エリア（10種） |
| | `household_size` | 数値 | `1`〜`5` | 世帯人数 |
| | `kwh` | 数値 | `330` | 試算に使った月間使用量 |
| | `kwh_overridden` | 真偽 | `true` | 使用量を手入力したか（false=世帯人数からの目安） |
| | `ampere` | 数値 | `30` `40` `50` | 契約アンペア（最低料金制エリアでは既定値のまま） |
| | `municipality_code` | 文字列 | `22210` | `?code=` プリセット経由の時のみ |
| `denki_offer_impression` | `area` | 文字列 | `tokyo` | |
| | `offer_count` | 数値 | `0` `3` | baseline を除く掲載プラン数 |
| | `has_affiliate` | 真偽 | `false` | 提携リンクを含むか |
| `denki_offer_click` | `offer_id` | 文字列 | `baseline-tokyo` | data/denki-plans.json の offerId |
| | `area` | 文字列 | `tokyo` | |
| | `is_affiliate` | 真偽 | `false` | 提携リンクか公式素リンクか |
| | `position` | 数値 | `0` | 結果リスト内の表示順（0始まり） |

> **`non_interaction` の注記**: GA4 では旧 Universal Analytics のような「非インタラクション ヒット」の
> 概念はなく、この値は効果を持ちません（エンゲージメント計算は別ロジック）。害はないため単なる
> パラメータとして残しています。

---

## 2. 初期セットアップ（マージ後に一度だけ行う）

イベントの **収集** はコードのデプロイ時点で自動的に始まります。GA4 側で必要なのは、
パラメータをレポート／探索で**分解・集計できるようにする**「カスタム定義」の登録です。
未登録だとパラメータは `(not set)` 扱いになり分析できません。

### 2-1. 届いているか確認（DebugView）

1. ブラウザ拡張「Google Analytics Debugger」を ON にする（または本番URLに `?debug_mode=1` を付与）
2. GA4 →（左下）**管理** → プロパティ列の **DebugView**
3. 本番サイトで「地図クリック／検索／指標切替」を操作
4. タイムラインに `select_municipality` `change_metric` `web_vitals` が出れば成功。
   イベントをクリックすると `method` 等のパラメータも確認できる

### 2-2. カスタム ディメンション（テキスト）を登録

**管理 → プロパティ列 → カスタム定義 → 「カスタム ディメンションを作成」**。範囲はすべて **イベント**。
以下は **2026-09-04 時点で登録済み**（20個）。

| ディメンション名（任意） | 範囲 | イベント パラメータ |
|---|---|---|
| 指標名 | イベント | `metric_name` |
| 評価 | イベント | `metric_rating` |
| 選択方法 | イベント | `method` |
| 自治体コード | イベント | `municipality_code` |
| 塗り分け指標 | イベント | `metric_key` |
| 自治体名 | イベント | `municipality_name` |
| 供給エリア | イベント | `area` |
| オファーID | イベント | `offer_id` |
| セクション | イベント | `section` |
| 掲載面 | イベント | `placement` |
| 診断の重み | イベント | `weights` |
| 診断の地方 | イベント | `regions` |
| 共有コンテンツ種別 | イベント | `content_type` |
| 共有アイテムID | イベント | `item_id` |
| 家賃上限フィルタ | イベント | `rent_max` |
| 地価上限フィルタ | イベント | `land_max` |
| 浸水深上限フィルタ | イベント | `flood_max` |
| 空き家率上限フィルタ | イベント | `vacancy_max` |
| 高齢化率上限フィルタ | イベント | `aging_max` |
| 将来人口下限フィルタ | イベント | `future_min` |

> フィルタ系の数値パラメータ（`rent_max` 等）は「50000円」のような離散的な選択肢しか取らないため、
> 平均を出す指標ではなく内訳を見るディメンションとして登録している。

### 2-3. カスタム指標（数値）を登録

**「カスタム指標を作成」**。以下は **2026-09-04 時点で登録済み**（7個）。

| 指標名（任意） | 範囲 | パラメータ | 測定単位 |
|---|---|---|---|
| Web Vitals値 | イベント | `value` | ミリ秒（標準） |
| 試算kWh | イベント | `kwh` | 標準 |
| 世帯人数 | イベント | `household_size` | 標準 |
| 契約アンペア | イベント | `ampere` | 標準 |
| 掲載オファー数 | イベント | `offer_count` | 標準 |
| 表示順 | イベント | `position` | 標準 |
| 診断結果件数 | イベント | `result_count` | 標準 |

### 注意点

- **遡及しない**: 登録後に届いたデータから適用。**過去データには反映されない**
- **反映時間**: 標準レポートに出るまで最大 24〜48 時間。早く見たいときは「探索」かリアルタイムを使う
- **上限**: イベント範囲のカスタム ディメンション／指標は無料枠で各 **50 個**（現在はディメンション20個＋指標7個）
- **カーディナリティ**: `municipality_code` は最大 1,918 通り。上限内だが、高カーディナリティの
  ディメンションは一部レポートで集約表示される場合がある

---

## 3. 分析レシピ（探索レポート）

**探索 → 空白** から自由形式レポートを作成する。

### A. Web Vitals の健全性
- 行: `指標名`(metric_name)、`評価`(metric_rating)
- 値: `Web Vitals値` の **平均**、`イベント数`
- → 「LCP の good/needs-improvement/poor 割合」「INP の平均ms」などが見える

> Web Vitals は公式には平均でなく **75 パーセンタイル**で評価する。GA4 の探索はパーセンタイル表示が
> 弱いため、厳密に追うなら **BigQuery エクスポート**（管理 → BigQuery のリンク、無料）で p75 を算出するのが
> おすすめ。日常監視は GA4 の平均＋rating 割合で十分。

### B. 自治体選択の導線
- 行: `選択方法`(method)（必要なら `自治体コード` を追加）
- 値: `イベント数`
- → 地図クリック vs 検索の比率、人気自治体ランキング

### C. 指標切替の利用
- 行: `塗り分け指標`(metric_key)
- 値: `イベント数` または `総ユーザー数`
- → 家賃／地価／人口トレンドのどれが使われているか

---

### D. 「条件の組み合わせ」需要の観測（AND 組み合わせページを作る前に）

2026-09-05 の調査で、2軸以上の意図を含む検索クエリは 62日で **5件・のべ13表示**しか
無かった（「神奈川 家賃安い 住みやすい」8表示など）。条件は6軸×3値あり、組み合わせを
静的ページ化すると数が爆発してインデックス予算を毀損する側に倒れる。**作る前に需要を測る**。

測り方は2系統。どちらも既存の計測だけで足り、新しいページは作らない。

1. **実際の利用から**（GA4・`apply_filter`）— 探索レポートで内訳ディメンションに
   `rent_max` / `flood_max` / `vacancy_max` / `aging_max` / `future_min` を並べ、
   同時に2つ以上が「条件なし」以外になっている行を数える。
   ユーザーが実際に複数条件を重ねているかが分かる（意図の実在確認）。
2. **検索需要から**（GSC）— `npm run gsc:analyze` の `queries.csv` に対し、
   軸語（家賃/相場・災害/浸水・子育て/保育・空き家・人口・高齢/老後・住みやす）が
   2つ以上同居する行を抽出して表示回数の合計を見る。

**判断の目安**: 上記2系統のどちらかで、組み合わせ意図が月あたり数百表示規模に
育ったら静的ページ化を検討する。それまでは `/map` のフィルタ（URL 同期済み）で
共有可能にしておくに留める。

---

## 4. 任意: キーイベント（旧コンバージョン）

`select_municipality` をサイトの主目的とみなす場合、**管理 → イベント** で該当イベントを
「キーイベントとしてマーク」すると、コンバージョンとして扱われ獲得レポート等に紐づく。

- **キーイベント化済み**（2026-09-04 時点）: `select_municipality`・`share`・`shindan_run`
- **点灯待ち**: `kasai_link_click` は AT 提携→env 設定で発火し始めた後に、`denki_offer_click` は
  /denki に提携オファーを掲載した時点で、同様にキーイベント化する（GA4 の UI は
  発火済みイベントへの星付けのみ。未発火のイベント名は一覧に出ない）。

---

## 5. コードを変更するとき

- 新しいイベントを足す場合は `lib/analytics.ts` に薄いラッパ関数を追加し、UI 側はそれを呼ぶ
  （`gtag` を直接叩かない＝no-op 保証と型を一箇所に集約するため）。
- 命名: サイト横断の操作は `動詞_目的語`（`select_municipality` 等）、特定ページ固有の
  イベントは `<ページ>_` 接頭辞（`denki_simulate` 等）で統一する。
- パラメータ名を変えた／増やした場合は、本ドキュメントの一覧と GA4 のカスタム定義も更新する。
- 測定ID を変える場合は `app/layout.tsx` の `GA_MEASUREMENT_ID` を変更する。
