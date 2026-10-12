# インデックス状態の継続計測

固定対象は `index-audit-2026-10-11.csv` の370 URL（GSCレポート更新日10/04）。現在の未登録総数として扱わない。原CSVの `last_crawl_report=1970-01-01` は未クロールの出力値であり、実際のクロール日時として使わない。URL Inspection APIはインデックス内の情報を返し、ライブ検査や登録リクエストは行わない。

## 再検査

既存のGSC readonlyサービスアカウント設定を `.env.local` に置く。認証方法はREADMEのGSC分析ツールと同じ。

```bash
npm run gsc:inspect -- --output=reports/gsc/index-monitor/2026-10-12.jsonl
npm run gsc:inspect:diff -- reports/gsc/index-monitor/2026-10-12.jsonl reports/gsc/index-monitor/2026-10-19.jsonl
```

再検査日ごとに出力ファイルを変える。同じファイルへの再実行は成功済みURLをスキップし、取得失敗URLと未処理URLを再開する。`--limit=10` は入力の先頭10 URLだけに絞る。`--input=...` はURLが先頭のCSV、`--site=sc-domain:kurashimap.jp` はGSCプロパティを指定する。別originのURLは拒否する。

URL検査は2,000件/日/サイトの枠を他の作業と共有する。週1回370件を基準とし、429/5xxは回数を限って再試行する。429が継続する場合は途中で停止する。HTTPエラーや結果欠落を未登録として数えない。差分の `recrawled` は初めてクロール日時が得られた場合も含む。検査しなかったURLは `not inspected` とする。

出力は `reports/gsc/` に保存してGit管理しない。最新ファイルの集計が前回と同じでも、Googleの実時間の状態や登録保証を意味しない。GA4の新イベントは追加しない。

## 内部リンク監査

```bash
npm run gsc:audit-links > reports/gsc/index-monitor/links.json
```

出力先のディレクトリを先に作る。入力CSVの10/04理由が「検出」の93 URLを対象に、トップ、ランキング一覧、47県ハブ、24全国ランキングのHTMLを取得する。通常の `a[href]` を抽出し、取得したページ群からの最短リンク数と参照元を記録する。

この監査はサイト全ページのグラフではない。深度が得られないURLも「孤立」と断定しない。参照元取得に失敗すれば `complete=false` と非ゼロ終了コードを返す。クエリ付きリンクは件数を別に記録し、到達性集計ではベースパスへまとめる。クエリ付きURL自体はクロールしない。`--base=http://localhost:3000` で同じ対象パスをローカルの参照元HTMLに照合できる。

2026-10-12の本番監査では、参照元73ページが全件200・自己canonical、93 URLすべてに通常リンクがあった。トップからの深度は1が4件、2が89件。結果は [index-link-audit-2026-10-12.json](index-link-audit-2026-10-12.json)。これを根拠に今回の修正ではリンクを増設しない。

## 個別canonical異常

`/ranking/rent-cheap/yamanashi` のGoogle選定canonicalは10/11時点の索引情報では外部URLだった。現行ページは200・自己canonicalだが、6/21の配信原因は未特定。公開URLテスト、当時のdeployment/logの確認、必要に応じた登録リクエストはGSC/Vercelで別途実施する。監査スクリプトはこれらを代行しない。10/12の新スクリプトによる4 URLの実API確認でも、地図3件はクロール済み未登録、山梨家賃は重複扱いだった。認証・結果保存の動作確認であり、未登録全件の再集計ではない。

## 評価

公開前基準と7・14・28日後の同じURL群で、理由、取得可否、Google選定canonical、最終クロールを比較する。検索表示・クリックはGSC Search Analyticsの確定期間で別に照合する。表示なしを未登録と判定しない。
