# GA4カスタムディメンション登録項目

診断・電気料金導線のイベントパラメータをGA4探索で利用するための登録一覧。GA4管理画面の「データの表示 → カスタム定義 → カスタムディメンション」で、イベントスコープとして登録する。

| 表示名 | イベントパラメータ | 主なイベント | 用途 |
| --- | --- | --- | --- |
| 診断結果順位 | `position` | `shindan_result_click`, `shindan_compare_click` | 何位の結果がクリックされたか |
| 自治体コード | `municipality_code` | `shindan_result_click`, `shindan_compare_click` | クリックされた自治体 |
| 診断条件 | `weights` | `shindan_run`, `shindan_result_impression`, `shindan_result_scroll` | 重視軸の組み合わせ |
| 診断地方 | `regions` | `shindan_run`, `shindan_result_impression`, `shindan_result_scroll` | 地方フィルター別の差分 |
| 診断結果件数 | `result_count` | `shindan_run`, `shindan_result_impression`, `shindan_result_scroll` | 結果表示数・対象母数 |
| 診断対象自治体数 | `eligible_count` | `shindan_result_impression` | 条件に合致した母数 |

イベント名はコード側で送信済み。カスタム定義の登録後、GA4探索で「イベント名」「診断結果順位」「診断条件」を組み合わせ、結果表示→スクロール→詳細/比較クリックの漏斗を作る。

