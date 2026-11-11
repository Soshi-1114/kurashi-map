# Google 5xx検証の追跡（2026-11-11 22:17 JST）

## Search Consoleの実測

[検証詳細](https://search.google.com/search-console/index/validation?resource_id=sc-domain%3Akurashimap.jp&item_key=CAMYEyAC)をChromeの画面で確認した。

- 検証: **開始**
- 開始日: **2026/11/11**
- 保留: **5件**
- 失敗: **0件**
- 集計レポートの最終更新日: **2026/11/06**

Googleの検証完了はまだ確認できていない。検証は再開始せず、そのまま継続する。「HTTP正常」と「Googleの検証合格」は別の状態として扱う。Google側で再クロールと検証が終わった後に、この画面の結果を再確認する必要がある。

## 本番の再確認

2026-11-11 22:17:53 JSTに、以下の全7URLがHTTP 200・Content-Type `image/png`・PNGシグネチャ正常・1200×630pxであることを確認した。

|URL|GSCの対象|結果|
|---|---|---|
|https://kurashimap.jp/api/og/pref/kumamoto|対象|200 / PNG 1200×630|
|https://kurashimap.jp/api/og/01437|対象|200 / PNG 1200×630|
|https://kurashimap.jp/api/og/27103|対象|200 / PNG 1200×630|
|https://kurashimap.jp/api/og/21215|対象|200 / PNG 1200×630|
|https://kurashimap.jp/api/og/34431|対象|200 / PNG 1200×630|
|https://kurashimap.jp/api/og|代表URL|200 / PNG 1200×630|
|https://kurashimap.jp/api/og/ranking/rent-cheap|代表URL|200 / PNG 1200×630|

この確認で本番へのデプロイ・設定変更・再検証開始は行っていない。既存修正のHTTP正常を確認したもので、Googleによる再クロールの代わりにはならない。
