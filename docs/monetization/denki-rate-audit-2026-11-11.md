# 電気料金 全プラン照合（2026-11-11）

収録済みの16プラン・56エリア料金ブロックすべてについて、公式料金表の基本料金（30/40/50A）または最低料金、含有kWh、3段階単価、段階境界を照合した。50ブロックを更新し、北陸の6ブロックは単価変更なし。東急は基本料金のみ更新。確認月は2026-11、確認日は2026-11-11。

試算対象は税込の基本／最低料金＋電力量料金のみ。燃料費等調整・再エネ賦課金・政府補助・各社割引・ポイントは含まない。11月改定は各社の適用条件に従うため、11月に請求される全契約の実請求額を表すものではない。利用者には概算として表示する。

## 取り違えを防いだ箇所

- 比較基準は大手10社の規制料金。北陸電力の「従量電灯B」は30.86／34.75／36.46円。「従量電灯ネクスト」の30.82／34.71／36.42円とは別プランであり混在させない。
- ENEOSはVページの料金例に10月31日以前の説明が残るため、[11月1日実施の供給条件説明書](https://www.eneos-power.co.jp/denki/contract/pdf/supply_20261101.pdf) p.8〜13の表を使用し、PDFを描画して表を確認。中部・九州の基本料金は大手と異なるため個別転記。関西・中国・四国はAプラン。
- [idemitsuの要綱一覧](https://denki.idemitsu.com/terms/list.html#sp-youkou)には旧版・新版が併記される。北陸以外は2026-11-01版、北陸は改定対象外として従来要綱。関西・中国・四国のSプランAと、kVA契約のSプランBを区別。中国の最低料金は873.37円（大手983.37円とは異なる）。
- TERASELは従来／超TERASEL、アンペア契約B／最低料金A、再エネオプションを区別。10A単価を3・4・5倍して30/40/50Aに換算。北海道の第2段階上限は280kWh。
- ミツウロコの従量電灯A/Bとシングル応援プランを区別。北陸以外は2026年11月検針日、北陸は2024年4月検針日からの現行表。
- 東急は[2026-11-01料金定義書](https://www.tokyu-ps.co.jp/home/denkigas/contract/download/pricedefinition_lv_20261101.pdf) p.5の従量電灯Bを使用し、PDFを描画して表を確認。電力量単価は据え置き、基本料金は変更。

## 全56ブロックの照合表

基本／最低料金は円/月。配列は30A・40A・50Aの順。最低料金の含有量は丸括弧に記載。電力量単価は第1・第2・第3段階の円/kWh。境界は月間の累計kWh（最終段階は上限なし）。各行の出典は、当該プラン・当該エリアの表を示す。

|プランID|エリア|基本／最低料金|段階単価|境界|公式出典・箇所|適用条件|
|---|---|---|---|---|---|---|
|baseline-hokkaido|hokkaido|1716.30 / 2288.40 / 2860.50|35.77 / 42.06 / 45.78|120 / 280|[従量電灯B](https://www.hepco.co.jp/home/price/ratemenu/meterratelight.html)|2026-11-11現在の現行公表表|
|baseline-tohoku|tohoku|1232.13 / 1642.84 / 2053.55|31.01 / 37.76 / 41.71|120 / 300|[従量電灯B](https://www.tohoku-epco.co.jp/dprivate/plan/home/lightb/)|2026-11-11現在の現行公表表|
|baseline-tokyo|tokyo|1176.18 / 1568.24 / 1960.30|29.85 / 36.45 / 40.54|120 / 300|[従量電灯B](https://www.tepco.co.jp/ep/private/plan/chargelist01.html)|2026-11-11現在の現行公表表|
|baseline-chubu|chubu|1343.76 / 1791.68 / 2239.60|21.25 / 25.73 / 28.68|120 / 300|[従量電灯B](https://miraiz.chuden.co.jp/home/electric/menu/pricelist/basic/)|2026-11-11現在の現行公表表|
|baseline-hokuriku|hokuriku|907.50 / 1210.00 / 1512.50|30.86 / 34.75 / 36.46|120 / 300|[従量電灯B（従量電灯ネクストとは別表）](https://www.rikuden.co.jp/ryokin/minsei.html)|現行公表表（11月改定対象外）|
|baseline-kansai|kansai|763.81（15kWh含む）|20.89 / 26.29 / 29.27|120 / 300|[従量電灯A](https://kepco.jp/ryokin/menu/dento_a/)|2026-11-11現在の現行公表表|
|baseline-chugoku|chugoku|983.37（15kWh含む）|33.32 / 40.00 / 42.12|120 / 300|[従量電灯A](https://www.energia.co.jp/elec/h_menu/pricelist/pricelist1.html)|2026-11-11現在の現行公表表|
|baseline-shikoku|shikoku|953.13（11kWh含む）|31.42 / 38.04 / 41.55|120 / 300|[従量電灯A](https://www.yonden.co.jp/customer/price/plan/juryo_a.html)|2026-11-11現在の現行公表表|
|baseline-kyushu|kyushu|1325.07 / 1766.76 / 2208.45|18.33 / 23.93 / 26.93|120 / 300|[従量電灯B](https://customer.kyuden.co.jp/ja/electricity/home-plan/jyuryo-b.html)|2026-11-11現在の現行公表表|
|baseline-okinawa|okinawa|767.82（10kWh含む）|42.06 / 47.60 / 49.58|120 / 300|[従量電灯](https://www.okiden.co.jp/individual/price-menu/specific/)|2026-11-11現在の現行公表表|
|terasel-cho|tokyo|1176.18 / 1568.24 / 1960.30|29.85 / 34.31 / 35.69|120 / 300|[料金の詳細（超TERASEL東京B）](https://www.terasel.jp/charge/terasel-plan/)|2026-11-11現在の現行公表表|
|terasel-b|tokyo|1141.86 / 1522.48 / 1903.10|29.05 / 35.39 / 39.31|120 / 300|[料金の詳細（TERASEL東京B）](https://www.terasel.jp/charge/terasel-plan/)|2026-11-11現在の現行公表表|
|terasel-cho|hokkaido|1716.30 / 2288.40 / 2860.50|35.77 / 39.74 / 42.43|120 / 280|[料金の詳細（超TERASEL北海道B）](https://www.terasel.jp/charge/terasel-plan/)|2026-11-11現在の現行公表表|
|terasel-b|hokkaido|1675.38 / 2233.84 / 2792.30|34.82 / 40.86 / 44.43|120 / 280|[料金の詳細（TERASEL北海道B）](https://www.terasel.jp/charge/terasel-plan/)|2026-11-11現在の現行公表表|
|terasel-cho|tohoku|1232.13 / 1642.84 / 2053.55|30.90 / 36.75 / 38.42|120 / 300|[料金の詳細（超TERASEL東北B）](https://www.terasel.jp/charge/terasel-plan/)|2026-11-11現在の現行公表表|
|terasel-b|tohoku|1192.53 / 1590.04 / 1987.55|30.35 / 36.83 / 40.62|120 / 300|[料金の詳細（TERASEL東北B）](https://www.terasel.jp/charge/terasel-plan/)|2026-11-11現在の現行公表表|
|terasel-cho|chubu|1343.76 / 1791.68 / 2239.60|21.06 / 24.94 / 26.41|120 / 300|[料金の詳細（超TERASEL中部B）](https://www.terasel.jp/charge/terasel-plan/)|2026-11-11現在の現行公表表|
|terasel-b|chubu|1330.89 / 1774.52 / 2218.15|20.93 / 25.35 / 28.25|120 / 300|[料金の詳細（TERASEL中部B）](https://www.terasel.jp/charge/terasel-plan/)|2026-11-11現在の現行公表表|
|terasel-cho|hokuriku|907.50 / 1210.00 / 1512.50|30.66 / 33.90 / 34.38|120 / 300|[料金の詳細（超TERASEL北陸B）](https://www.terasel.jp/charge/terasel-plan/)|2026-11-11現在の現行公表表|
|terasel-b|hokuriku|878.46 / 1171.28 / 1464.10|30.12 / 33.85 / 35.49|120 / 300|[料金の詳細（TERASEL北陸B）](https://www.terasel.jp/charge/terasel-plan/)|2026-11-11現在の現行公表表|
|terasel-cho|kansai|763.81（15kWh含む）|20.89 / 25.09 / 24.47|120 / 300|[料金の詳細（超TERASEL関西A）](https://www.terasel.jp/charge/terasel-plan/)|2026-11-11現在の現行公表表|
|terasel-b|kansai|746.76（15kWh含む）|19.87 / 25.00 / 27.84|120 / 300|[料金の詳細（TERASEL関西A）](https://www.terasel.jp/charge/terasel-plan/)|2026-11-11現在の現行公表表|
|terasel-cho|chugoku|983.37（15kWh含む）|33.32 / 38.80 / 37.17|120 / 300|[料金の詳細（超TERASEL中国A）](https://www.terasel.jp/charge/terasel-plan/)|2026-11-11現在の現行公表表|
|terasel-b|chugoku|966.53（15kWh含む）|32.28 / 38.63 / 40.64|120 / 300|[料金の詳細（TERASEL中国A）](https://www.terasel.jp/charge/terasel-plan/)|2026-11-11現在の現行公表表|
|terasel-cho|shikoku|953.13（11kWh含む）|31.42 / 36.85 / 36.07|120 / 300|[料金の詳細（超TERASEL四国A）](https://www.terasel.jp/charge/terasel-plan/)|2026-11-11現在の現行公表表|
|terasel-b|shikoku|932.56（11kWh含む）|30.41 / 36.70 / 40.03|120 / 300|[料金の詳細（TERASEL四国A）](https://www.terasel.jp/charge/terasel-plan/)|2026-11-11現在の現行公表表|
|terasel-cho|kyushu|1325.07 / 1766.76 / 2208.45|18.15 / 22.92 / 24.34|120 / 300|[料金の詳細（超TERASEL九州B）](https://www.terasel.jp/charge/terasel-plan/)|2026-11-11現在の現行公表表|
|terasel-b|kyushu|1280.52 / 1707.36 / 2134.20|17.45 / 22.77 / 25.62|120 / 300|[料金の詳細（TERASEL九州B）](https://www.terasel.jp/charge/terasel-plan/)|2026-11-11現在の現行公表表|
|mitsuuroko-juryo|hokkaido|1716.30 / 2288.40 / 2860.50|35.77 / 37.36 / 40.33|120 / 280|[従量電灯B（シングル応援プランを除外）](https://mitsuurokogreenenergy.jp/ryokin/tanka.html)|2026年11月検針日から|
|mitsuuroko-juryo|tohoku|1232.13 / 1642.84 / 2053.55|33.04 / 35.65 / 39.23|120 / 300|[従量電灯B（シングル応援プランを除外）](https://mitsuurokogreenenergy.jp/ryokin/tanka.html)|2026年11月検針日から|
|mitsuuroko-juryo|tokyo|1176.18 / 1568.24 / 1960.30|31.96 / 33.18 / 35.84|120 / 300|[従量電灯B（シングル応援プランを除外）](https://mitsuurokogreenenergy.jp/ryokin/tanka.html)|2026年11月検針日から|
|mitsuuroko-juryo|chubu|1343.76 / 1791.68 / 2239.60|23.31 / 23.62 / 26.21|120 / 300|[従量電灯B（シングル応援プランを除外）](https://mitsuurokogreenenergy.jp/ryokin/tanka.html)|2026年11月検針日から|
|mitsuuroko-juryo|kansai|756.52（15kWh含む）|22.74 / 24.91 / 26.29|120 / 300|[従量電灯A（シングル応援プランを除外）](https://mitsuurokogreenenergy.jp/ryokin/tanka.html)|2026年11月検針日から|
|mitsuuroko-juryo|chugoku|893.61（15kWh含む）|35.37 / 37.14 / 38.80|120 / 300|[従量電灯A（シングル応援プランを除外）](https://mitsuurokogreenenergy.jp/ryokin/tanka.html)|2026年11月検針日から|
|mitsuuroko-juryo|shikoku|953.13（11kWh含む）|33.93 / 36.49 / 38.16|120 / 300|[従量電灯A（シングル応援プランを除外）](https://mitsuurokogreenenergy.jp/ryokin/tanka.html)|2026年11月検針日から|
|mitsuuroko-juryo|kyushu|1325.07 / 1766.76 / 2208.45|20.35 / 20.48 / 24.20|120 / 300|[従量電灯B（シングル応援プランを除外）](https://mitsuurokogreenenergy.jp/ryokin/tanka.html)|2026年11月検針日から|
|mitsuuroko-juryo|hokuriku|907.50 / 1210.00 / 1512.50|31.88 / 33.39 / 34.39|120 / 300|[従量電灯B（シングル応援プランを除外）](https://mitsuurokogreenenergy.jp/ryokin/tanka.html)|2024年4月検針日から|
|idemitsu-s|hokkaido|1716.30 / 2288.40 / 2860.50|35.77 / 40.82 / 42.35|120 / 280|[Sプラン 3(4)（SプランB・kVA契約を除外）](https://denki.idemitsu.com/docs/hokkaido_spplan_20261101.pdf)|2026-11-01実施|
|idemitsu-s|tohoku|1232.13 / 1642.84 / 2053.55|31.01 / 37.08 / 39.31|120 / 300|[Sプラン 3(4)（SプランB・kVA契約を除外）](https://denki.idemitsu.com/docs/tohoku_spplan_20261101.pdf)|2026-11-01実施|
|idemitsu-s|tokyo|1176.18 / 1568.24 / 1960.30|29.85 / 34.81 / 37.15|120 / 300|[Sプラン 3(4)（SプランB・kVA契約を除外）](https://denki.idemitsu.com/docs/kanto_spplan_20261101.pdf)|2026-11-01実施|
|idemitsu-s|chubu|1343.76 / 1791.68 / 2239.60|21.25 / 25.15 / 26.51|120 / 300|[Sプラン 3(4)（SプランB・kVA契約を除外）](https://denki.idemitsu.com/docs/chubu_spplan_20261101.pdf)|2026-11-01実施|
|idemitsu-s|hokuriku|907.50 / 1210.00 / 1512.50|30.86 / 33.92 / 34.40|120 / 300|[Sプラン 3(4)（SプランB・kVA契約を除外）](https://denki.idemitsu.com/docs/hokuriku_spplan.pdf)|11月改定対象外、従来の要綱を継続適用|
|idemitsu-s|kansai|763.81（15kWh含む）|20.89 / 24.92 / 27.26|120 / 300|[SプランA 3(4)（SプランB・kVA契約を除外）](https://denki.idemitsu.com/docs/kansai_spplan_20261101.pdf)|2026-11-01実施|
|idemitsu-s|chugoku|873.37（15kWh含む）|33.32 / 39.06 / 40.07|120 / 300|[SプランA 3(4)（SプランB・kVA契約を除外）](https://denki.idemitsu.com/docs/chugoku_spplan_20261101.pdf)|2026-11-01実施|
|idemitsu-s|shikoku|953.13（11kWh含む）|31.42 / 36.96 / 38.95|120 / 300|[SプランA 3(4)（SプランB・kVA契約を除外）](https://denki.idemitsu.com/docs/shikoku_spplan_20261101.pdf)|2026-11-01実施|
|idemitsu-s|kyushu|1325.07 / 1766.76 / 2208.45|18.33 / 23.22 / 24.42|120 / 300|[Sプラン 3(4)（SプランB・kVA契約を除外）](https://denki.idemitsu.com/docs/kyushu_spplan_20261101.pdf)|2026-11-01実施|
|eneos-v|hokkaido|1716.30 / 2288.40 / 2860.50|35.59 / 40.55 / 42.94|120 / 280|[供給条件説明書 p.8 Vプラン](https://www.eneos-power.co.jp/denki/contract/pdf/supply_20261101.pdf)|2026-11-01実施版（料金算定期間の開始日が11/1以降。北陸は改定対象外）|
|eneos-v|tohoku|1232.13 / 1642.84 / 2053.55|30.86 / 37.05 / 39.85|120 / 300|[供給条件説明書 p.9 Vプラン](https://www.eneos-power.co.jp/denki/contract/pdf/supply_20261101.pdf)|2026-11-01実施版（料金算定期間の開始日が11/1以降。北陸は改定対象外）|
|eneos-v|tokyo|1176.18 / 1568.24 / 1960.30|29.85 / 34.90 / 36.95|120 / 300|[供給条件説明書 p.9 Vプラン](https://www.eneos-power.co.jp/denki/contract/pdf/supply_20261101.pdf)|2026-11-01実施版（料金算定期間の開始日が11/1以降。北陸は改定対象外）|
|eneos-v|chubu|1342.68 / 1790.24 / 2237.80|21.04 / 24.97 / 26.69|120 / 300|[供給条件説明書 p.10 Vプラン](https://www.eneos-power.co.jp/denki/contract/pdf/supply_20261101.pdf)|2026-11-01実施版（料金算定期間の開始日が11/1以降。北陸は改定対象外）|
|eneos-v|hokuriku|907.50 / 1210.00 / 1512.50|30.70 / 34.20 / 34.93|120 / 300|[供給条件説明書 p.11 Vプラン](https://www.eneos-power.co.jp/denki/contract/pdf/supply_20261101.pdf)|2026-11-01実施版（料金算定期間の開始日が11/1以降。北陸は改定対象外）|
|eneos-v|kansai|708.69（15kWh含む）|20.89 / 24.58 / 27.38|120 / 300|[供給条件説明書 p.11 Aプラン](https://www.eneos-power.co.jp/denki/contract/pdf/supply_20261101.pdf)|2026-11-01実施版（料金算定期間の開始日が11/1以降。北陸は改定対象外）|
|eneos-v|chugoku|983.37（15kWh含む）|33.15 / 39.28 / 40.29|120 / 300|[供給条件説明書 p.12 Aプラン](https://www.eneos-power.co.jp/denki/contract/pdf/supply_20261101.pdf)|2026-11-01実施版（料金算定期間の開始日が11/1以降。北陸は改定対象外）|
|eneos-v|shikoku|953.13（11kWh含む）|31.41 / 37.39 / 39.38|120 / 300|[供給条件説明書 p.12 Aプラン](https://www.eneos-power.co.jp/denki/contract/pdf/supply_20261101.pdf)|2026-11-01実施版（料金算定期間の開始日が11/1以降。北陸は改定対象外）|
|eneos-v|kyushu|1323.72 / 1764.96 / 2206.20|18.26 / 23.23 / 24.95|120 / 300|[供給条件説明書 p.13 Vプラン](https://www.eneos-power.co.jp/denki/contract/pdf/supply_20261101.pdf)|2026-11-01実施版（料金算定期間の開始日が11/1以降。北陸は改定対象外）|
|tokyu-b|tokyo|1096.44 / 1461.92 / 1827.40|31.39 / 31.89 / 36.14|120 / 300|[料金定義書 p.5 従量電灯B](https://www.tokyu-ps.co.jp/home/denkigas/contract/download/pricedefinition_lv_20261101.pdf)|2026-11-01実施|

## 検証

- 公式値からの手計算による試算テストを全16プランに用意。北海道280kWh、最低料金に含む10/11/15kWh、30/40/50Aを含む。
- 既存のデータ検証で10エリアの比較基準・基本料金形式・段階境界・正の単価を確認。
- 実行結果はPRに記載。
