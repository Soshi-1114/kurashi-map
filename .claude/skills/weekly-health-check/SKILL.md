---
name: weekly-health-check
description: GSC/GA4の週次ヘルスチェック。検索パフォーマンス(7日比較)・インデックス状況・GA4主要指標を確認し、前回からの変化と要対応事項を要約報告する
---

# 週次ヘルスチェック（GSC / GA4）

kurashimap.jp の検索・アクセス状況を毎週確認し、変化点と要対応事項を報告する。
ブラウザ（claude-in-chrome）でユーザーのログイン済みセッションを使う。

## 前提

- GSC プロパティ: `sc-domain:kurashimap.jp`
- GA4 プロパティ: `a397689937p542476262`（kurashi-map）
- 前回までの経緯・ベースラインはメモリ `ga4-gsc-audit-2026-07`・`keyword-research-2026-07` を参照

## 手順

1. **GSC 検索パフォーマンス（7日 vs 前7日比較）**
   `https://search.google.com/search-console/performance/search-analytics?resource_id=sc-domain%3Akurashimap.jp&num_of_days=7&compare_date=PREV`
   - 合計クリック・表示回数・CTR・平均掲載順位の前週比
   - ページ別で増減トップ5（「差」列ソート。表示回数の増減も見る）
   - クエリ別でゼロクリック高表示の新顔（新指標=空き家率・人口密度・住みやすさ系の露出開始を確認）
2. **GSC インデックス**
   `https://search.google.com/search-console/index?resource_id=sc-domain:kurashimap.jp`
   - 登録済み/未登録の数値推移（レポートは数週遅行する点に注意）
   - 「クロール済み-インデックス未登録」の検証ステータス（2026-07-27 に再検証開始済み → 合格/不合格を確認）
3. **GA4 ホーム/トラフィック獲得（過去7日）**
   `https://analytics.google.com/analytics/web/#/a397689937p542476262/reports/intelligenthome`
   - アクティブユーザー・新規の前週比、チャネル別（Organic/Direct/AI Assistant）
   - キーイベント `select_municipality` の件数（2026-07-27 設定。0のままなら設定確認）
   - Search Console 連携レポート（検索クエリ）が出現しているか
4. **報告**
   - 3行サマリー（良化/悪化/横ばい＋主因）→ 詳細表 → 要対応事項（あれば）
   - 大きな変化（±30%超、検証合格/不合格、新クラスタの出現）があれば深掘りしてから報告
   - 終了時にメモリ `ga4-gsc-audit-2026-07` の数値ベースラインを最新値で更新する

## 注意

- カバレッジレポートは実態より数週古い。個別URLの実状態は URL 検査が正
- 本番デプロイは手動運用（メモリ `deploy-workflow-preference`）。デプロイが必要な提案をする場合はユーザーに依頼する
