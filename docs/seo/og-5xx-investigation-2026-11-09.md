# GSC サーバーエラー（5xx）調査 — 2026-11-09

## 確認結果

GSC「サーバーエラー（5xx）」の例は5件。初検出日は画面上2026/11/07、レポート最終更新日は2026/11/06と表示されている。通知日を障害開始日とは扱わない。

| URLパス | GSC前回クロール | 本番GET |
|---|---|---|
| `/api/og/pref/kumamoto` | 2026/11/07 | 500 |
| `/api/og/01437` | 2026/11/06 | 500 |
| `/api/og/27103` | 2026/11/05 | 500 |
| `/api/og/21215` | 2026/11/03 | 500 |
| `/api/og/34431` | 2026/11/01 | 500 |

2026-11-09 19:03〜19:05 JST頃に確認。トップページHEADは200、追加確認した `/api/og` のGETも500。5件は共有用OG画像のURLであり、本文ページのインデックス障害とは区別する。サイト全本文の正常性・インデックス状態はこの調査では断定しない。

## 原因と修正

Vercel Runtime Logsで、調査時の全6リクエストに共通して以下を確認した。

- `Invalid value "46" for "width"` / `height`（数値・auto・百分率を要求）
- `failed to pipe response`、原因 `svgload_buffer: SVG rendering failed` / `vips2png: unable to write to target target`

共有パーツ `lib/og.tsx` のロゴ画像が `width="46" height="46"` を渡していた。`width={46} height={46}` に修正。既存のrobots許可や画像デザインを変更する必要はない。

ローカルNext.js 16.4.3の実HTTPで修正前の `/api/og` の同じ警告と500を再現。修正後は対象5件、`/api/og`、`/api/og/ranking/rent-cheap` の7件すべて200・`image/png`。熊本県画像を開き、1200×630のロゴ・日本語・統計表示も確認。型チェックと変更ファイルのESLintで検証。

## 公開後に必要な確認

本調査時点ではローカル修正のみ。本番デプロイもGSC「修正を検証」も未実施。

修正を本番へ反映した後、対象5件と共通OGが200・PNGになることを確認し、Vercelログで描画エラーが再発しないことを確認する。その後GSCの同じ5xxレポートで「修正を検証」を開始する。検証開始はインデックス登録や即時のレポート解消を保証しない。

GSCレポート: https://search.google.com/search-console/index/drilldown?resource_id=sc-domain%3Akurashimap.jp&item_key=CAMYEyAC
