# Google AdSense の申請・掲載・停止手順

この手順は掲載作業の引き継ぎ用。収益調査の記録ではない。アカウント情報・本人確認書類・銀行情報はリポジトリへ保存しない。

## 申請準備

1. 所有者のGoogleアカウントで [AdSense](https://adsense.google.com/start/) を開き、日本の支払い情報と `kurashimap.jp` を登録する。本人確認・規約同意・支払い情報の入力は所有者が行う。
2. 所有者から提供された公開IDは `ca-pub-5168889916977587`。共通headの `google-adsense-account` メタタグと `/ads.txt` に使用する。別アカウントのIDを使う場合は `NEXT_PUBLIC_ADSENSE_CLIENT_ID` を変更して再ビルド・再デプロイする。
3. 広告配信は未指定または `NEXT_PUBLIC_ADSENSE_ENABLED=false` で停止する。所有権確認とads.txtは配信停止中も有効。
4. 変更を本番へデプロイして、ページソースのメタタグ、`https://kurashimap.jp/ads.txt` のHTTP 200・公開ID、プライバシーポリシーを確認する。
5. AdSenseの「サイト」で確認方法にメタタグ（またはads.txt）を選び、所有権確認・審査を依頼する。通常数日、場合によって2〜4週間。審査中は自動広告を有効にしない。「要対応」なら指摘を修正し、「準備完了」になるまで配信しない。

## 承認後の管理画面設定

1. 「広告 → 広告ユニット単位 → ディスプレイ広告」で、レスポンシブの `kurashimap-ranking-content` と `kurashimap-area-content` を作る。
2. 発行コードの `data-ad-client` が所有権確認のIDと一致することを確認し、各 `data-ad-slot`（10桁）を次のProduction環境変数へ設定する。

   ```dotenv
   NEXT_PUBLIC_ADSENSE_ENABLED=false
   NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-5168889916977587
   NEXT_PUBLIC_ADSENSE_RANKING_SLOT_ID=<ランキングの10桁ID>
   NEXT_PUBLIC_ADSENSE_AREA_SLOT_ID=<詳細ページの10桁ID>
   ```

3. 自動広告・全画面・追従・広告インテント・自動最適化は無効のままとする。広告枠は本文中に手動配置済みで1ページ1枠。
4. 「プライバシーとメッセージ」でGoogleの欧州規制メッセージを作成する。サイトを選び、対象地域はEEA・英国・スイス。言語は日本語と英語。「同意しない」を有効、同意メッセージ最適化と自動のカバレッジ最大化を無効にし、`https://kurashimap.jp/privacy` を指定して公開する。CMPの広告目的のConsent Mode設定も有効にする。拒否・管理・撤回の動作をGoogleのプレビュー機能で検証する。
5. Google CMPのAPIが利用可能な広告ページには、フッターに「プライバシーとCookieの設定」を表示する。CMPが提供する自動の撤回リンクも維持する。拒否時の配信方式はGoogle CMPの選択信号に従い、独自に同意状態を上書きしない。

## 配置・配信条件

- 全国ランキング：全順位表の後。県内ランキング：順位リストの後。都道府県ランキング：全47県の表の後。
- 都道府県詳細：データ概況の後。自治体詳細：相対比較の説明の後。説明がなければ詳細データの後。
- 高さ250px、幅可変、上下48pxの余白。「広告」を表示し、表・カード・操作部品の中には挿入しない。広告が配信されなくても枠を急に縮めない。
- トップ・ランキング一覧・地図・比較・電気・街診断・備蓄・検索・案内・404には広告枠を設置しない。
- 既存アフィリエイトとデータ・順位・試算条件は変更しない。
- 実配信はVercel Productionビルドの `https://kurashimap.jp` のみ。`NEXT_PUBLIC_ADSENSE_PRODUCTION` はNext configが自動生成するため手動設定しない。
- ローカル・Previewでは有効フラグと有効な公開ID・広告枠IDを設定するとダミー枠だけを表示する。設定不足や無効時には枠自体を表示しない。試験用に仮のIDを本番へ設定しない。
- 広告対象への出入り・広告対象間は文書全体を読み直し、広告スクリプトやCSPを操作ページへ引き継がない。アンカー移動・比較候補への追加は維持する。

## 公開・検証・停止

1. 型チェック、lint、テスト、本番ビルドを通す。プレビューで320/390/768/1440px幅、比較候補、試算入力引き継ぎ、新規タブ、戻る・進むを確認する。
2. 審査「準備完了」、必要な本人確認、CMP設定完了を確認してから、Productionの `NEXT_PUBLIC_ADSENSE_ENABLED=true` へ変更し、再ビルド・本番デプロイする。環境変数の編集だけでは静的ページは更新されない。
3. 閲覧ページで1枠、操作ページで0枠を確認する。操作ページへ直接アクセスした場合と、広告ページから移った場合の両方で広告通信がないことを確認する。広告を自分でクリックして確認しない。
4. 当日と翌日は配信・ブラウザエラー・ads.txt・ポリシーセンターを確認する。表示には最長1時間、ads.txtの管理画面への反映には数日以上かかる場合がある。
5. 7日後にユニット別収益・配信率・視認性・表示ずれを確認。28日後にGA4の閲覧数・詳細/比較への回遊と合わせて評価する。タイムゾーンをそろえ、単なるアクセス増加を広告の効果としない。収益はAdSenseレポートを正とし、広告クリックを独自に計測しない。
6. 操作不能、対象外配信、重大なポリシー警告があれば停止する。CLSはp75で0.1以下を目標とし、広告による悪化は枠の追加より配置・サイズの修正で対応する。
7. 停止は `NEXT_PUBLIC_ADSENSE_ENABLED=false` → 再ビルド → 本番デプロイ。広告スクリプト・枠・文書遷移の切り替えを無効化し、全ページのCSPを従来の制限へ戻す。確認メタタグ・ads.txtは残す。片方だけ止める場合は該当する広告枠IDを空欄にして再デプロイする。

### CSPのトレードオフ

現在の静的HTML配信を維持するため、本番で広告を有効化したページ群のみCSPのリソース取得制限を外す。object/base/frame-ancestors/form-action/HTTPS保護は維持する。操作ページは既存のCSPを維持する。AdSenseの変動する配信先を許可リストへ追加して追従する実装は採用しない。

### 入金

日本円の支払い基準額は8,000円。本人確認・住所確認・支払い情報などの条件を満たす必要があり、残高不足や保留中は翌月以降へ繰り越される。原則21〜26日に支払い手続きとなる。収益発生と銀行への入金は分けて確認する。

## 公式資料

- [セットアップ・審査・本人確認](https://support.google.com/adsense/answer/7402256?hl=ja)
- [メタタグでの所有権確認](https://support.google.com/adsense/answer/7584263?hl=ja)
- [ads.txt](https://support.google.com/adsense/answer/12171612?hl=ja)
- [広告ユニットの作成](https://support.google.com/adsense/answer/9274025?hl=ja)
- [許容されるレスポンシブ広告のサイズ変更](https://support.google.com/adsense/answer/9183363?hl=ja)
- [CSPとの統合](https://support.google.com/adsense/answer/16283098?hl=ja)
- [プライバシーポリシーの必須事項](https://support.google.com/adsense/answer/1348695?hl=ja)
- [欧州規制メッセージ](https://support.google.com/adsense/answer/10960768?hl=ja)
- [同意の撤回](https://support.google.com/adsense/answer/10959060?hl=ja)
- [支払い基準額](https://support.google.com/adsense/answer/1709871?hl=ja)・[支払いスケジュール](https://support.google.com/adsense/answer/7164703?hl=ja)
