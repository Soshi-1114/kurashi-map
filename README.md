# KurashiMap（kurashi-map）

市区町村別の住みやすさ関連データ（家賃相場・地価・人口・子育て・災害リスク・生活インフラ）を地図上で横断比較できる、一般向け無料Webサービスです。

地図が主役で、自治体を選ぶとサイドパネル（PC）／下部シート（SP）に要約＋数値が出て、詳細SEOページへ遷移します。

**全47都道府県・1,918自治体**（市区町村1,747＋政令市の行政区171）を、政府統計・国土数値情報の**実データ**で収録しています。

## 技術スタック

- Next.js 14（App Router、SSG）
- TypeScript
- MapLibre GL JS（地図基盤は OpenFreeMap Positron）
- デプロイ: Vercel

## セットアップ

```bash
npm install
npm run dev
# → http://localhost:3000
```

ビルド確認（全自治体の詳細ページを静的生成）:

```bash
npm run build
```

データ取得スクリプトを動かす場合のみ、`.env.example` を `.env.local` にコピーして API キーを設定します（閲覧・ビルドには不要）。`.env.local` はコミットしないでください。

- `REINFOLIB_API_KEY` … 国土交通省「不動産情報ライブラリ」（地価・ハザード・生活インフラ）
- `ESTAT_APP_ID` … e-Stat（人口・家賃）

## 主要構成

```
kurashi-map/
├ app/
│  ├ page.tsx                      # トップ＝全画面地図モード
│  ├ area/[pref]/[city]/page.tsx   # 自治体詳細ページ（SEO・構造化データ付き）
│  ├ api/og/[code]/route.tsx       # OG画像を動的生成
│  ├ api/muni/[code]/route.ts      # 自治体フルデータの取得API
│  ├ api/tile/[z]/[x]/[y]/route.ts # 地理院タイルの同一originプロキシ（OpenFreeMap fallback、現状未使用）
│  ├ sitemap.ts / robots.ts        # 全自治体URLのサイトマップ
├ components/
│  ├ MapView.tsx                   # MapLibreラッパ。県geojsonをビューポート遅延ロード
│  ├ AreaPanel.tsx                 # PCサイドパネル＋ MetricCards / buildSummary()
│  └ MobileSheet.tsx               # SP下部シート（3段階）
├ lib/
│  ├ types.ts                      # 【固定】Municipality 型・Metric 型
│  ├ metrics.ts                    # pref別JSONの動的importローダ（コード分割）
│  ├ prefs.ts                      # 47県の登録（PREFS）と loadPrefData
│  ├ rentColor.ts                  # 家賃→色＋データなし判定（hasRent）
│  ├ landPrice.ts / waitlist.ts / coverage.ts  # 欠損・非公表・対象外の判定ヘルパー
│  ├ summary.ts / related.ts / site.ts
├ data/
│  ├ {pref}.json                   # 市区町村データ（47県）
│  └ {pref}_wards.json             # 政令市の行政区データ
├ public/
│  ├ prefectures.geojson           # 47県の輪郭（起動時ロード）
│  └ {pref}.geojson / {pref}_wards.geojson  # 行政区域ポリゴン（簡略化済）
└ scripts/                         # データ取得・生成スクリプト（下記）
```

## データパイプライン

新規県の追加・再取得は `scripts/` を 1 県ずつ実行する（slug例 `--pref=saitama`）。

| スクリプト | 内容 | 出典 |
|---|---|---|
| `build-base.mjs` | N03から skeleton JSON＋簡略化geojsonを生成（政令市は区をdissolve） | 国土数値情報 N03 |
| `fetch-population-2025.mjs` | 人口・増減トレンド | 令和7年(2025)国勢調査 速報 |
| `fetch-rent.mjs` | 民営借家の家賃平均 | 住宅・土地統計調査（e-Stat） |
| `fetch-land-price.mjs` | 住宅地地価 | 地価公示／都道府県地価調査（L01/L02） |
| `fetch-hazard.mjs` | 浸水想定・土砂災害警戒区域 | 国土数値情報（reinfolib XKT026/029） |
| `fetch-amenities.mjs` | 駅・保育園等・医療機関の数 | 国土数値情報（reinfolib XKT015/007/010） |
| `fetch-waitlist.mjs` | 待機児童数 | こども家庭庁 保育所等関連状況取りまとめ |

`fetch-hazard` / `fetch-amenities` は `tilesForPolys()` で**自治体ポリゴンに交差するタイルだけ**を取得するため、北海道や離島県のような広域bboxでも海上タイルを取得せずに済む。

定期/手動でデータを更新する GitHub Actions（`data-update-annual` / `data-update-quarterly`）の更新頻度・手動更新箇所・実行手順・既知の注意点は **[`docs/data-update.md`](docs/data-update.md)** を参照。

## GSC分析ツール（SEO分析）

`scripts/gsc/`（TypeScript、`tsx` で実行）は Google Search Console の Search Analytics API から検索パフォーマンスを取得し、
KurashiMap の URL構造・自治体マスタ（`data/*.json`）と突き合わせて SEO 分析データセットを生成するツール。
GSC API 呼び出し（`api.ts` / `auth.ts`）、分類（`urlMeta.ts` / `queryMeta.ts`）、集計（`aggregate.ts`）、
Opportunity 抽出（`opportunities.ts`）、レポート出力（`report/`）を分離している。閾値・分類ルールは `config.ts` に集約。

### GSC分析ツールの認証設定

1. Google Cloud Console でプロジェクトを作成し、**Search Console API** を有効化する。
2. サービスアカウントを作成し、JSON キーをダウンロードする（Git 管理しないこと）。
3. [Search Console](https://search.google.com/search-console) の対象プロパティ（`https://kurashimap.jp/` または
   ドメインプロパティ `sc-domain:kurashimap.jp`）の「設定 → ユーザーと権限」で、サービスアカウントのメールアドレスを
   **閲覧者（Restricted）以上**として追加する。
4. `.env.local` に以下のいずれかを設定する（`.env.example` 参照）。
   - `GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json`（推奨。ファイルは Git 管理しない）
   - もしくは `GSC_CLIENT_EMAIL` + `GSC_PRIVATE_KEY`（JSON 内の値をそのまま貼り付け。`\n` は自動で改行に変換される）
5. `GSC_SITE_URL` で対象プロパティを指定する（既定 `sc-domain:kurashimap.jp`）。URLプレフィックスプロパティを使う場合は
   `GSC_SITE_URL=https://kurashimap.jp/` にする。

### GSCデータ取得・分析

```bash
npm run gsc:analyze -- --days 28          # 既定28日
npm run gsc:analyze -- --days 7
npm run gsc:analyze -- --days 90
npm run gsc:analyze -- --days 28 --compare        # 直前の同じ長さの期間と比較
npm run gsc:analyze -- --days 28 --compare=yoy    # 前年同期と比較（サイト全体・ページ単位のみ）
```

**施策の効果検証**（本番反映日を挟んで前後を比べる）:

```bash
# 本番反映日の前後28日を比較。「後」がまだ足りない場合は警告付きで切り詰める
npm run gsc:analyze -- --days 28 --since=2026-08-20

# 任意の基準期間と比較（例: 施策投入前の28日を基準にする）
npm run gsc:analyze -- --days 28 --baseline=2026-07-11..2026-08-07
```

`--since` / `--baseline` は過去のレポートディレクトリを読むのではなく **GSC API から当該期間を取り直す**（`reports/gsc/` は Git 管理外で再現性がなく、ディレクトリ名も実行日であってデータ期間ではないため）。GSC は約16か月ぶん保持しているので、過去の任意期間はいつでも再構成できる。

どの施策がどのURL群を変えたかは **`docs/seo/url-sets.json`** に定義する（施策と同じPRでコミットする）。グロブ（`*`=1セグメント、`**`=以降すべて）で指定でき、比較実行時に summary.md の「施策URLセットの効果」節と `url-sets.csv` に前後比較が出る。

`since` には**新しい内容が丸一日配信された最初の日**を書く（深夜デプロイならその翌日）。デプロイ当日は旧内容が大半の時間を占めるため、その日を含めると「施策前」と「施策後」が混ざる。比較した2期間がこの日を挟めているかは自動判定され、挟めていないセットは summary.md で ⚠️ 表示になる（`straddlesDeploy`）。同じURL群を指すセットを2つ置くことはできない（効果を分離できないため、読み込み時にエラーになる）。

比較ありで実行すると、上記に加えて **ページタイプ別の増減**（`page-type-diff.csv`）と **自治体ページの露出率（Exposure Rate）の推移** も出力される。

出力先は `reports/gsc/{実行日}/`（Git 管理外。`.gitignore` 参照）:

```
reports/gsc/2026-08-10/
  summary.md              # 人間・AI 双方向けのMarkdownレポート
  analysis.json           # ChatGPT / Claude にそのまま渡せる分析用JSON
  analysis-prompt.md       # analysis.json を分析させるためのプロンプト雛形
  daily.csv / pages.csv / queries.csv / page-query.csv
  municipalities.csv / prefectures.csv / opportunities.csv / no-impression-pages.csv
  page-type-diff.csv / url-sets.csv   # 比較あり（--compare / --since / --baseline）のときのみ
  raw/                     # GSC API の生レスポンス（トレーサビリティ用）
```

**GSC データの既知の制約**（`summary.md` の Data Notes にも記載）: Search Analytics API は 1 サイトあたりの返却上限・
上位データ中心の抽出・低頻度クエリの匿名化があり、完全な全件取得は保証されない。直近数日はデータ未確定のため集計対象から
除外している（`config.ts` の `END_DATE_LAG_DAYS`）。期間比較のうち Winners/Losers・順位変動・新規露出はページ単位のみで、
クエリ単位の期間比較は行わない。

## データの扱い（honesty 方針）

欠損を推計値で埋めず、`source` 文字列のセンチネルで UI が「データなし／対象外／区別非公表」を表示する。

- **家賃**: 住宅統計の対象外な小町村は `データなし（住宅統計の集計対象外）`（地図はグレー）
- **地価**: 地価公示・調査の標準地がない自治体（北方領土・帰還困難区域・小離島）は `対象外`
- **待機児童**: 政令市は市単位集計。区別公表市は実値、非公表市は `区別非公表（◯◯市全体でN人）`
- **ハザード／生活インフラ**: reinfolib 圏外の北方領土は `対象外`

判定は `lib/rentColor.hasRent` / `lib/landPrice.hasLandPrice` / `lib/waitlist.isWaitlistDisclosed` / `lib/coverage.isHazardEvaluated・isAmenitiesCounted` に集約。サンプル/推計プレースホルダは収録していない（0件）。

## 設計原則（守ること）

- 型（`lib/types.ts`）・データスキーマ・家賃の色しきい値（`lib/rentColor.ts`）は安易に変えない。
- API キーはサーバー側／取得スクリプトのみで使用し、クライアントに露出させない。
- **治安・犯罪データは扱わない**（法務方針）。
- 欠損は推計で埋めず `データなし／対象外` と明示する（上記 honesty 方針）。

## 出典クレジット

- 地図基盤: [OpenFreeMap Positron](https://openfreemap.org/)（OpenStreetMap データ、OpenMapTiles スキーマ、CC0 / ODbL）
- 行政区域: 国土数値情報「行政区域データ（N03）」
- 人口: 総務省統計局「国勢調査」（e-Stat 経由）
- 家賃: 総務省統計局「住宅・土地統計調査」（e-Stat 経由）
- 地価・ハザード・生活インフラ: 国土交通省「不動産情報ライブラリ」（reinfolib）／国土数値情報
- 待機児童: こども家庭庁「保育所等関連状況取りまとめ」ほか各政令市公表値

## ライセンス

未定（内部開発用）。
