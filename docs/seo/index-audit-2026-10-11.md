# KurashiMap インデックス未登録調査（2026-10-11）

## 対象と方法

- GSC ドメインプロパティ `sc-domain:kurashimap.jp` の「ページのインデックス登録」を、**送信済みページ**に絞って確認。画面の最終更新日は **2026-10-04**。
- 理由別の CSV を3件エクスポートし、370 URL を [`index-audit-2026-10-11.csv`](index-audit-2026-10-11.csv) に統合。元の出力はローカルの `reports/gsc-index-audit-2026-10-11/` に保存。全 URL が 2026-10-11 取得の本番 `sitemap.xml` 3,139 URL に含まれることを確認。
- 370 URL 全件を GSC URL 検査 API で追加確認。サイトマップの他 URL も含め、計1,719 URL を検査。URL 検査はインデックス内の状態を返し、ライブページの登録可否を予測するものではない。[URL 検査 API](https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect)
- 本番 HTML と実装を代表 URL で照合。コード変更なし。

## 抽出結果

| GSC送信済みページ（10/04更新） | URL数 |
|---|---:|
| 登録済み | 2,769 |
| 未登録 | 370 |
| 合計 | 3,139 |

| 未登録理由 | URL数 |
|---|---:|
| クロール済み・インデックス未登録 | 276 |
| 検出・インデックス未登録 | 93 |
| 重複・ユーザー指定canonicalなし | 1 |

| ページ群 | サイトマップ掲載 | GSC未登録 | 主な理由 |
|---|---:|---:|---|
| 自治体詳細 | 1,918 | 249 | クロール済み233、検出のみ16 |
| 県別ランキング | 1,128 | 101 | 検出のみ72、クロール済み28、重複1 |
| 全国ランキング | 24 | 8 | クロール済み7、検出のみ1 |
| 県ハブ | 47 | 9 | クロール済み5、検出のみ4 |
| 地図（汎用＋8指標） | 9 | 3 | すべてクロール済み |
| その他 | 13 | 0 | — |

GSCの「すべての既知のページ」では未登録1,987件だが、そこにはパラメータ付きURLやAPI等が含まれる。登録を狙う対象は送信済み370件として扱う。Googleも、重複や意図的な除外が未登録に含まれ、すべてのURLの登録を期待しないよう説明している。[ページのインデックス登録レポート](https://support.google.com/webmasters/answer/7440203?hl=ja)

10/11のURL検査では、この370件のうち4件が「送信して登録されました」に変わっていた。したがって370は10/04時点の完全な抽出結果であり、10/11の実時間の未登録総数ではない。CSVに両時点の状態を記録した。

## 原因の切り分け

1. **広域の取得障害は確認できない。** GSCで「クロール済み」の276件はURL検査で全件 `pageFetch=SUCCESSFUL`、`robots=ALLOWED`。代表ページは現在200応答、`index, follow`、自己参照canonical。GSCクロール統計は過去90日でホスト問題なし、平均応答349ms、応答200が表示上100%（丸め値）。技術的な遮断が主因という根拠はない。
2. **検出のみ93件は県別ランキングに集中する（72件）。** 例として `/ranking/stations/kyoto` は現行の県ハブと全国駅ランキングの両方から通常のHTMLリンクがあり、サイトマップにも載る。リンク欠落とは言えない。Googleのクロール優先順位・URL在庫・需要などが仮説であり、ホスト容量問題とは断定できない。[Googleのクロール診断](https://developers.google.com/search/docs/crawling-indexing/troubleshoot-crawling-errors)
3. **「本文が薄い」と一括判定する根拠もない。** 未登録の県別ランキング101件と他1,027件は、既存 `rankBy` による掲載自治体数の中央値がどちらも29件。未登録群に10件未満は0件。自治体詳細249件は家賃欠損61件（24.5%）で、他1,669件の630件（37.7%）より高くない。甲府市の本番HTMLは本文約6,200文字、正しいcanonicalと出典・実数値を持ち、登録済みの富士吉田市と同じ構造。Googleが個別URLを登録しない正確な判断要因はGSCから分からない。
4. **地図3件の `lastmod` は実態と一致しない。** `/map`、`/map/hazard`、`/map/vacancy` はGit履歴で2026-08-28〜29に新設されたが、現在のサイトマップでは3件とも2026-08-17。`/map` のサーバーHTMLにはH1がなく、地図以外の可視テキストは約685文字。これらは改善対象だが、同じ `lastmod` の登録済み地図もあるため未登録の直接原因とは断定しない。Googleは正確な`lastmod`を利用し、`priority`と`changefreq`は無視する。[サイトマップ仕様](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
5. **canonical異常が1件。** `/ranking/rent-cheap/yamanashi` は2026-06-21のGoogleクロールで、無関係な `https://www.747live.bet/` をGoogle選定canonicalとしている。現行HTMLとGooglebot User-Agentでの取得結果は一致し、自己参照canonical、200応答、`index, follow`。GSCのセキュリティ問題・手動対策はどちらも「問題は検出されませんでした」。原因は未特定で、過去の応答・外部コピー・Google側の判定を調べる必要がある。Google選定canonicalはサイト側指定と異なり得る。[canonicalの説明](https://developers.google.com/search/docs/crawling-indexing/canonicalization)

## SEO改善施策（優先順）

| 優先 | 施策・対象 | 根拠 | 実装案・規模 | 検証 |
|---|---|---|---|---|
| P0 | 山梨県の家賃ランキングの外部canonicalを個別調査 | 送信済みで唯一の異常。Google選定先が無関係な外部ドメイン | GSCライブ検査、6/21前後の配信ログ・デプロイ履歴、現在のレスポンスを確認。原因が配信側なら修正。調査は小 | Google選定canonicalが自己URLに戻るか、再クロール・登録状況を追跡 |
| P1 | 地図3ページの正確な`lastmod`と`/map`のサーバーHTML改善 | 公開日より前の`lastmod`、`/map`はH1欠落と短い静的説明 | `lib/dataFreshness.ts`・`app/sitemap.ts`で実際の公開・主要更新日をページ別に表現。`app/map/page.tsx`と既存`HomeLinks`に、見出し・比較可能な指標・欠損表示・操作の説明をサーバー描画。小〜中 | sitemapの日時、HTMLのH1・canonical・内部リンク、3 URLの再クロール・登録、地図への検索表示 |
| P1 | 「検出のみ」の県別ランキング72件をクロール診断 | サイトマップと関連ページからのリンクは存在、ホスト障害もなし | `app/ranking/[metric]/page.tsx`、`app/area/[pref]/page.tsx`の既存リンクを保ち、対象URLのリンク深度・クエリ付き重複URL流入・クロールログを調査。需要のある群だけ20 URL程度でリンク文脈と到達性を試験。小〜中 | 対象群と対照群の最終クロール日、検出→クロール済みへの遷移、登録率 |
| P2 | クロール済み自治体詳細233件の小規模コンテンツ試験 | 取得・robotsは正常、欠損値や掲載行数だけでは説明できない | `app/area/[pref]/[city]/page.tsx`の既存実データ・`buildHighlights`等を使い、検索需要と本文のずれが確認できる10 URLで冒頭の比較要約を改善。推計値は使わず、出典・基準年を維持。中 | 対照URLと14・28日比較で、再クロール、登録、GSC表示・クリック・主要クエリを確認 |
| P2 | 未登録の全国ランキング8件を個別評価 | `/ranking/rent-cheap`等は既に方法説明と上位100表があり、汎用的な増量は根拠不足 | 各ページのSERPとGSCクエリ、現行本文の答えを照合し、需要が確認できたページだけタイトル・冒頭説明を試験。小 | URL検査の登録、クエリ別表示・CTR・順位 |

新しいデータ軸やページ種別は提案していない。追加を検討する場合は `docs/new-metric-criteria.md` の基準を先に適用する。

## 実装前に確認すること

- canonical異常URLの6/21前後の実配信内容。現在のHTMLだけでは当時のGoogle選定理由を確定できない。
- 「検出のみ」のURL群でGooglebotのリクエストが実際に来ていないか、VercelログとGSCクロール統計の該当期間を照合する。
- コンテンツ試験候補の実検索結果とクエリ需要。全自治体への一括変更や新規ページ量産をこの結果だけで決めない。
- 施策の評価は、URL検査とGSCページ別表示・クリックを同一URL群、同一期間で行う。Googleのインデックス登録は保証されない。[SEOスターターガイド](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
