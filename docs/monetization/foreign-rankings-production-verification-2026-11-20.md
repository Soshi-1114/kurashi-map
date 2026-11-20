# 外国人住民・教育環境ランキング：本番配信・計測確認

確認日：2026-11-20（JST）。対象：PR #273、mainのマージコミット `ed99f6fae4bdd66be3d1bd4bfdcd41f80b384910`。

## 本番で確認済み

| URL | 手動広告 | 初期HTMLの順位表 | GA4送信 |
| --- | --- | --- | --- |
| /ranking/foreign-resident-growth | 1枠・filled / done | 100行 | 閲覧・表視認 |
| /ranking/foreign-resident-growth-rate | 1枠・filled / done | 100行 | 閲覧・表視認 |
| /ranking/foreign-student-elementary-ratio | 1枠・filled / done | 47行 | 閲覧・表視認 |
| /ranking/foreign-student-junior-ratio | 1枠・filled / done | 47行 | 閲覧・表視認 |

新規5URLのHTTP 200、canonical、構造化データ、サイトマップ登録を確認。公開画面の「プロトタイプ」表記は削除済み。手動枠は `[data-ad-placement]` 内で数え、Googleが挿入する表示面積0の要素と区別した。広告クリックは行っていない。

中学校ランキングから地図へ移動すると、教育・2025年・中学校・愛知県（23）を引き継いだ。遷移先の地図では手動広告0、AdSenseライブラリの読み込み0を確認した。

## GA4の受信と集計の状態

ブラウザのdataLayerと計測通信で `new_ranking_view` / `new_ranking_table_view` を各ページで確認。さらにGA4の読み取り専用リアルタイムAPIで、以下の受信を確認した（2026-11-20 09:43:50 UTC取得）。

| イベント | リアルタイムでの件数 |
| --- | ---: |
| new_ranking_view | 4 |
| new_ranking_table_view | 4 |
| new_feature_navigation | 1 |

上記は運営側の本番確認を含み、自然流入・利用成果として評価しない。リアルタイムの件数はプロパティ内の対象イベント合計であり、日次のページ別集計や厳密なファネルを表すものではない。

通常のData APIでは、`hostName=kurashimap.jp` と上記4件の `pagePath` 完全一致をAND条件にし、当日〜取得日の閲覧・イベント・広告指標を取得した。リクエストは成功したが、いずれも行が未返却だった。公開直後の状態であり、0PV・0収益・計測障害とは判定しない。[Googleのデータ更新頻度](https://support.google.com/analytics/answer/11198161?hl=ja)では、処理に24〜48時間かかる場合がある。

メタデータで確認できた新機能関連の登録済みカスタムディメンションは `customEvent:metric_key`。`feature_id` / `geography` / `entry_type` / `destination` / `target_path` が標準レポートの内訳として使えるとはみなさない。初回のページ別評価は、カスタム定義を追加せず `pagePath` と `eventName` で集計できる。`totalAdRevenue` / `publisherAdImpressions` のリクエスト成功だけでAdSense連携や収益反映済みとは判断しない。

## AdSenseのページ別収益

「Top pages」の当日レポートは「結果はありません」。ページURLフィルターも「フィルタを読み込めませんでした」と表示され、この画面だけでは4URLの収益を確認できなかった。原因は未確定。

URLチャネルの管理画面には既存チャネルがなかった。以下の4URLを「チャネルを追加」に入力後、ユーザーが保存した。2026-11-20に管理画面で4件とも「有効」であることを確認した。

```text
kurashimap.jp/ranking/foreign-resident-growth
kurashimap.jp/ranking/foreign-resident-growth-rate
kurashimap.jp/ranking/foreign-student-elementary-ratio
kurashimap.jp/ranking/foreign-student-junior-ratio
```

URLチャネルは、広告コードを変更せずに対象URLを分けて計測するために使う。[GoogleのURLチャネル説明](https://support.google.com/adsense/answer/10075505?hl=ja)。登録後は4行の推定収益・ページビュー・表示回数・視認性を確認し、既存ランキング用ユニット全体の数値を新機能の成果にしない。ページRPMを4行の単純平均で計算せず、同じ期間・通貨の収益合計 / ページビュー合計 × 1000で算出する。

## 次の確認

1. URLチャネル4件の登録・有効化は完了。登録後のページ別集計が反映されるまで待つ。
2. 24〜48時間後に新規4URLの通常GA4・AdSense集計を再確認する。未取得を0に置換しない。
3. 11/27に広告配信・表示ずれ・エラーを確認する。実広告を含むSPの継続確認と、本番CLSの十分な観測は引き続き必要。
4. 初日11/20の運営確認を除外し、11/21〜12/18の28日を評価する。データ反映・GSC確定を待って集計する。
5. 母数が不足する場合は11/21〜2027/1/15の56日まで観測を延長する。日程は作業メモであり、自動実行・通知は設定していない。

本確認では本番コード・広告配置・配信設定・GA4の管理設定を変更していない。ローカルサーバーも再起動していない。
