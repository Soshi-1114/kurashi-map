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

## 2026-09-29 比較導線の追加定義（管理画面での登録状況は未確認）

| 表示名 | パラメータ | 対象イベント | 範囲 |
| --- | --- | --- | --- |
| 比較導線実験ID | `experiment_id` | `compare_cta_view`, `compare_cta_click` | イベント |
| 比較導線variant | `variant` | 同上 | イベント |
| 比較導線ページ | `page_path` | 同上 | イベント |
| 比較対象数 | `count` | `tool_entry`, `compare_ready`, `compare_view` | イベント・カスタム指標 |
| 比較候補数 | `count` | `compare_candidate_start` | イベント・カスタム指標 |
| 比較候補の追加元 | `tool_source` | `compare_candidate_add`, `compare_candidate_remove`, `compare_candidate_start` | イベント |
| 比較導線元ページ | `origin_path` | `tool_entry`, `compare_ready`, `compare_view`, `compare_cta_view`, `compare_cta_click` | イベント |
| 計測定義版 | `measurement_version` | `tool_entry`, `compare_ready`, `compare_view`, `compare_cta_view`, `compare_cta_click`, 診断結果イベント | イベント |

`tool_source` は既存の「道具への送客元」を使用する。GA4での新規定義登録は確認後に実施する。カスタム定義は登録前のイベントには遡及しないため、登録・本番受信・通常レポート反映の後を基準期間とする。`origin_path`は許可済みの大阪・福岡人口増加ランキングの値だけを送る。
