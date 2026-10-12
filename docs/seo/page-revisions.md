# ページの公開・更新日

`sitemap.xml` の `lastmod` と自治体Datasetの `dateModified` は `lib/pageRevisions.ts` の確認済み公開履歴から生成する。統計の `asOf`、Gitコミット日時、現在のビルド時刻は使わない。統計の基準時点・出典の本文表示は従来のデータを使う。

## 初回修正

過去の実公開日時を裏付けるdeployment記録をまだ取得できていないため、履歴は空で始める。初回反映時点では全3,139 URLをサイトマップに掲載し、`lastmod` を省略する。自治体構造化データも、公開履歴がなければ `dateModified` を省略する。URL削除、noindex、データ欠損の補完は行わない。

`lastmod` は任意項目なので、不明な日時を出すより省略する。[Googleのsitemap仕様](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)（2026-10-11確認）。Googleの再取得・登録改善を保証する修正ではない。

## 公開後に履歴を記録する

1. production deploymentが正常配信され、対象URLの本文・データ・構造化データが実質変更されたことを確認する。
2. deployment ID、実公開日時（UTC）、影響したURLを保存する。
3. `PAGE_REVISIONS` に次の形式で追加し、レビューして反映する。

```ts
{
  scope: { paths: ["/map"] },
  publishedAt: "YYYY-MM-DD", // 実際に公開したUTC日付へ置換
  evidence: "production deployment ID / commit / 変更理由",
}
```

テンプレートの変更が全対象ページに実質的な影響を与えた場合は `scope: { template: "municipality" }` 等を使える。`mapHub` は `/map/*` のみで、汎用 `/map` を含まない。`prefRanking` と `prefectureRanking` は別範囲。同日更新は正確なら同じ日付でよい。データ変更は実際に影響したURLだけ `paths` へ列挙する。

未来日、不正日付、証跡空欄は出力しない。履歴が複数あるURLは最新の確認済み日付を使う。軽微な装飾やリファクタ、ビルド、未変更URLの日時は進めない。証跡を確認できない期間は省略を維持する。

今回の地図説明変更の公開後は `/map` の実改訂日を記録する。後続の日時記録PRでsitemapだけ変わっても、他の3,138 URLを再更新扱いにしない。ロールバックで本文を実際に戻した場合は、その公開も履歴として記録する。

データ更新Actionへ自動接続する場合は `docs/data-update.md` を読み、JSON差分とproduction deploymentを対応付ける。元統計の年度を配信日とみなさない。現時点では自動追記を実装していない。
