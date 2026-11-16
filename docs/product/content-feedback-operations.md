# 情報の有用性アンケートの設定と運用

## 保存先と公開

このPRはアンケート画面・APIを実装するが、保存先の作成・契約・本番有効化は行わない。Redis REST API（Upstash互換）でHMGET・EXISTS・EVALを利用できるデータベースを用意する。画面は `/api/content-feedback` だけに通信し、保存先URLや秘密鍵をブラウザーへ渡さない。

サーバー環境変数に以下を設定する。NEXT_PUBLIC_は付けない。

- `FEEDBACK_ENABLED=true`
- `FEEDBACK_REDIS_REST_URL`: HTTPSのRESTエンドポイント。
- `FEEDBACK_REDIS_REST_TOKEN`: 対象DBに必要なコマンドを実行できるトークン。
- `FEEDBACK_SIGNING_SECRET`: 32文字以上のランダムな秘密鍵。

設定不足・無効時、GETは`available:false`を返し、UIは回答ボタン・件数を表示しない。保存障害では503とし、回答を成功扱いにしない。Previewでは本番と別DBを用い、確認操作を本番の回答に混ぜない。

## 公開前の受入確認

1. Previewで実際の保存先を設定し、初回0件から肯定・否定を送信して再読込後も件数が残ることを確認する。
2. 否定理由の選択あり・選択なし、同じブラウザーの二重クリック・再読込を確認。同一対象・版の重複で件数が増えないことを確認する。
3. 別ブラウザーで同じ集計を参照できること、地域別・県別・全国・自治体詳細の票が混ざらないことを確認する。
4. 保存先への接続失敗時に件数が増えず、再試行できることを確認する。
5. `/privacy#content-feedback`、Cookie設定、秘密情報がHTML/JSに含まれないことを確認する。
6. 確認完了を公開記録に残してからProductionの設定を有効にする。日付が来ただけで自動有効化しない。

## ページ・項目・版

ページID例は`ranking:stations`、`ranking:stations:pref:tokyo`、`ranking:stations:region:kanto`、`area:ibaraki:08201`。項目はランキングで`ranking`、自治体詳細の全体評価で`overview`。自由なパスや未収録自治体は受け付けない。自治体詳細の指標ごとの質問を増やす場合は、項目のallowlistと配置を別途追加する。

版は`lib/contentFeedback.ts`の`FEEDBACK_VERSION`。大きな改修時は版を変更して、前後の評価を別集計にする。初回は2026-11-16-v1。Cookieを削除した場合や別端末をまたぐ一人一票は保証せず、公開表示は「件」。肯定率を街の住みやすさや統計の正しさの点数に流用しない。

## 改善理由の取得

サーバー設定を読み込める環境で、次の管理用CLIを実行する。公開集計APIへ理由や匿名IDを追加する必要はない。

```sh
node --env-file=.env.local --import tsx scripts/feedback/report.ts --page ranking:stations --section ranking
node --env-file=.env.local --import tsx scripts/feedback/report.ts --page area:ibaraki:08201 --section overview
```

肯定・否定・理由別の件数だけをJSONで返す。回答者の識別子・署名鍵・トークンは出力しない。各ページの閲覧数・アンケート視認数等の分母は別に確認する。否定率だけで少数ページの改善順位を決めず、件数と閲覧数も考慮する。

## 重複・連投・停止

同一OriginのPOST、匿名HttpOnly Cookie、対象・版・ブラウザーに紐付くHMAC署名を検証する。回答記録と件数の更新はLua EVALで原子的に行う。1ブラウザーから新規対象へ1分10件を超える回答を制限する。生IPや自由入力は保存しない。Cookieを消した自動アクセス等を完全に防ぐ仕組みではないため、急増時はDBの利用量と件数を確認し、必要に応じて機能を停止する。

匿名Cookie・票の重複抑止キーは最長1年、ページ集計は最終回答から1年で期限切れ。署名鍵の変更では集計キーも変わるため、意図せず変更しない。停止は`FEEDBACK_ENABLED=false`で行い、APIが無効を返すことを確認する。既存回答は期限まで残る。長期保存や削除要件を変更する場合はプライバシー説明も更新する。

参考: [Redis REST API](https://upstash.com/docs/redis/features/restapi)、[EVAL](https://redis.io/docs/latest/commands/eval/)。
