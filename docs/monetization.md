# マネタイズ導線・ASP 提携の台帳

収益導線（ふるさと納税・火災保険・電気プラン）の ASP 申請状況と、承認後に必要な作業を
1か所にまとめる。コードは `lib/monetization.ts`（URL 生成の一元化）、設定は `.env.example`
（クライアント公開値のみ。リンクの実値はコミットしない）を参照。

方針（`lib/monetization.ts` 冒頭）: サイトの中立性を崩さない「文脈一致の導線」に限定し、
ASP 発行リンクは env で差し替える。広告の有無は掲載データの内容・順位に影響させない。

## 1. 提携状況（2026-09-10 時点）

| ASP | 広告主 | 導線 | 状況 | 備考 |
| --- | --- | --- | --- | --- |
| アクセストレード（AT） | ふるなび | ふるさと納税（自治体詳細・ランキング） | **承認**（2026-08） | 点灯済み。`docs/data-update.md` §13 |
| アクセストレード（AT） | 東急パワーサプライ（東急でんき） | 電気プラン（/denki） | **承認**（2026-09） | offer 未収録。§2 の作業が必要 |
| A8.net | ウェブクルー（火災保険 一括見積もり） | 火災保険（災害リスク文脈） | **承認**（2026-09） | env 設定で点灯。§2 |
| A8.net | 出光興産（idemitsuでんき） | 電気プラン（/denki） | 否認（2026-09） | `idemitsu-s` は公式サイトへの素リンク + UTM のまま掲載継続 |
| A8.net | ＴＧオクトパスエナジー | 電気プラン（/denki） | 否認（2026-09） | offer 未収録のまま。追加しない |
| （各社） | 上記以外の申請分 | — | 審査中 | 結果が出たらこの表に追記 |

- 否認された電気プランは、提携リンクがなくても `denkiOfferUrl` が公式サイトへの素リンク
  （UTM 付き・PR 表記なし）にフォールバックするので、掲載自体は続ける（比較ツールとしての
  有用性を優先。`lib/monetization.ts` の設計どおり）。
- 再申請する場合は、否認理由（ASP 管理画面の通知）をこの表の備考に残してから行う。

## 2. 承認済みプログラムの点灯作業

### A8 × ウェブクルー（火災保険）— env 設定のみ

1. A8 管理画面 → プログラム詳細 → 広告リンク（テキスト）を生成し、リンクコードから
   - `href` の URL → `NEXT_PUBLIC_KASAI_HOKEN_URL`
   - 同梱の 1x1 計測画像（`https://www1x.a8.net/0.gif?a8mat=...` 形式）→ `NEXT_PUBLIC_KASAI_HOKEN_PIXEL`
   を Vercel の環境変数に設定してデプロイする（`deploy-preview.yml` 手動実行）。
2. 表示面は `<KasaiBand>` / `<KasaiLink>` を置いた箇所（自治体詳細・/map/hazard・地図パネル・
   診断結果）。env 未設定の間は導線ごと非表示。
3. CSP（`next.config.mjs` の img-src）は `*.a8.net` を許可済み。計測画像のホストが
   `a8.net` 配下でなければ追加する。
4. 点灯後、GA4 で `kasai_link_click` が発火し始めたらキーイベント化する（`docs/analytics.md` §4）。
5. 文言は `components/monetization/KasaiLink.tsx` の制約（「お得」訴求なし・「広告」表記・
   不安を煽らない）を維持する。A8 の広告主ガイドラインに追加の禁止表現があれば同ファイルの
   コメントに追記する。

### AT × 東急パワーサプライ（東急でんき）— offer 収録 + env

東急でんきは東京電力エリアのみ供給。`data/denki-plans.json` に offer を足すまで送客先がない。

1. 公式の料金表ページ（tokyu-ps.jp）で従量電灯B相当プランの基本料金（30/40/50A）と
   3段階単価（〜120 / 〜300 / 300kWh超）を確認し、`areas.tokyo` のみ持つ offer として
   `data/denki-plans.json` に追加する（`sourceUrl`・`sourceAsOf`・`notes` を必ず埋める。
   ポイント・セット割等の特典は試算に含めない。`docs/data-update.md` §12 の手順に準拠）。
   ※ 本セッションの実行環境からは tokyu-ps.jp に到達できず、料金の確認ができなかったため
   未収録（推計値・仮置きは入れない方針）。
2. `lib/monetization.ts` の `denkiAffLinks()` に
   `"<offerId>": process.env.NEXT_PUBLIC_DENKI_AFF_TOKYU` を1行追加し、
   `.env.example` に同名の変数を追記する。
3. AT 管理画面のテキストリンク URL（`https://h.accesstrade.net/sp/cc?rk=...`）を
   Vercel の `NEXT_PUBLIC_DENKI_AFF_TOKYU` に設定してデプロイ。
4. 注意: `components/denki/DenkiSimulator.tsx` の提携リンクは現状 `rel` に `noreferrer` を
   含む。AT はリファラで掲載サイトを確認するため（`FurusatoLink` / `KasaiLink` と同じ理由）、
   AT リンクを点灯する前に `noreferrer` を外し `referrerPolicy="no-referrer-when-downgrade"`
   に揃える。あわせて AT の計測ピクセル（`sp/rr`）を対で描画するか検討する
   （`kasaiHokenLink` の `atImpressionPixel` を流用できる）。
5. `npx vitest run tests/lib/denkiPlans.test.ts tests/lib/monetization.test.ts` で検証し、
   点灯後 `denki_offer_click` をキーイベント化する。

## 3. 関連ファイル

- `lib/monetization.ts` … URL 生成・env 読み出しの一元化
- `.env.example` … 公開 env の一覧とコメント
- `components/monetization/` … ふるさと納税・火災保険の表示コンポーネント
- `components/denki/DenkiSimulator.tsx` / `data/denki-plans.json` … 電気プランの比較・送客
- `docs/analytics.md` … 各導線の GA4 イベント
- `docs/data-update.md` §12（電気料金プラン）・§13（ふるなび自治体ID）
