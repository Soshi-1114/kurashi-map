// 全指標共通の値の型。APIに差し替えてもこの型は変えない。
export type Metric = {
  value: number;
  unit: string;          // "円/月", "円/㎡", "人" など
  source: string;        // 出典表記
  asOf: string;          // 基準時点 "2023" など
  isEstimated: boolean;  // 推計値フラグ（欠落町村の補完等）
};

export type HazardInfo = {
  hasFloodRisk: boolean;
  hasLandslideRisk: boolean;
  // 段階値（順序尺度）。新データのみ持つ。未設定の旧データは has*Risk の boolean に
  // フォールバックする（lib/hazardScale.ts のアクセサ参照）。
  floodLevel?: number;     // 浸水深ランク 0=なし,1..6（reinfolib XKT026）
  landslideLevel?: number; // 0=なし,1=警戒区域,2=特別警戒区域（reinfolib XKT029）
  // 津波・高潮（沿岸のみ）。level: -1=対象外（内陸県等）, 0=想定なし, 1..8=深さランク。
  // depth: 最大深バンドの表示ラベル（例 "3m以上 ～ 5m未満"）。あり(level>=1)のときのみ。
  tsunamiLevel?: number;     // reinfolib XKT028（A40_003）
  tsunamiDepth?: string;
  stormSurgeLevel?: number;  // reinfolib XKT027（A49_003）
  stormSurgeDepth?: string;
  // 液状化（reinfolib XKT025）。level は小さいほど高リスク（1=非常に〜5=しにくい）。
  // -1=未評価（メッシュなし）。label は最悪メッシュの傾向テキスト（"非常に液状化しやすい" 等）。
  liquefactionLevel?: number;
  liquefactionLabel?: string;
  note: string;          // "荒川沿いに浸水想定" など
  source: string;
  asOf: string;
};

export type AdminLevel = "muni" | "ward"; // 市区町村 / 政令市の行政区

export type Municipality = {
  code: string;          // 全国地方公共団体コード 例 "11203"（市区町村） / "11107"（区）
  pref: string;          // "saitama"（URL用スラッグ）
  name: string;          // "川口市" / "浦和区"
  level?: AdminLevel;    // 既定は "muni"。"ward" の場合は parentCode 必須を想定
  parentCode?: string;   // ward の親市コード 例 "11100"
  displayName?: string;  // 表示用フルネーム 例 "さいたま市浦和区"。指定無ければ name にフォールバック
  population: number;
  populationTrend: "増加" | "微増" | "横ばい" | "微減" | "減少";
  // 5年間（2020→2025 国勢調査）の人口増減率（%）。ランキング用。
  // populationTrend はこの率の5区分（fetch-population-2025.mjs trendOf）。
  populationChangeRate?: number;
  // 面積（km²）。国土地理院「全国都道府県市区町村別面積調」（fetch-area.mjs）。
  // 人口密度（人/km²）は保存せず population と突き合わせて実行時に算出する
  // （在留外国人の人口比と同じ「派生値は保存しない」方針）。
  areaKm2?: number;
  rent: Metric;          // 民営借家の家賃平均
  landPrice: Metric;     // 住宅地地価
  waitlistChildren: Metric; // 待機児童（value=人数）
  // 保育所等の受け入れ状況（こども家庭庁「保育所等関連状況取りまとめ」別添
  // 「（参考）定員・申込者の状況」。待機児童と同一公表物・同一基準日）。
  // 政令市は市単位集計のため、区には市全体の値を source「（○○市全体の集計）」付きで持たせる
  // （lib/childcare.ts isChildcareCityAggregate）。定員余裕率などの派生値は保存せず実行時算出。
  // capacity=0 は「保育所等の定員なし」の実データ（小規模町村）。enrolled が capacity を
  // 超えることがある（定員の弾力運用）。
  childcare?: {
    capacity: number;      // 定員合計（全施設類型）
    enrolled: number;      // 利用児童数合計
    capacityAge0: number;  // 0歳児の定員
    enrolledAge0: number;  // 0歳児の利用児童数
    capacityAge12: number; // 1,2歳児の定員
    enrolledAge12: number; // 1,2歳児の利用児童数（出典の1歳児+2歳児）
    hiddenWaitlist: number; // 待機児童に含まれない申込者（育児休業中+特定園のみ希望+求職活動休止）
    source: string;
    asOf: string;
  };
  // 在留外国人総数（value=人数）。出入国在留管理庁 在留外国人統計。北方領土等は
  // source に「対象外」を持つ（lib/foreignResidents.ts hasForeignData 参照）。
  // 人口比（%）は保存せず population と突き合わせて実行時に算出する。
  foreignResidents: Metric;
  // 国籍上位（多様性表示用）。現状の整形では未収録のため任意。総数10人以下は
  // 国籍が秘匿（注2）＝「データ非開示」扱い（isNationalityDisclosed 参照）。
  foreignNationalities?: { nationality: string; count: number }[];
  // 空き家率（住宅・土地統計調査 表「居住世帯の有無(8区分)別住宅数」）。
  // rate = 空き家数 ÷ 住宅総数（%）。調査の市区町村集計は人口1.5万人未満の町村を
  // 含まないため、対象外は rate=-1 + source センチネル（lib/vacancy.ts hasVacancy 参照）。
  vacancy?: {
    rate: number;   // 空き家率%（小数1桁）。-1=対象外
    vacant: number; // 空き家数（戸）
    total: number;  // 住宅総数（戸）
    source: string;
    asOf: string;
  };
  // IPSS「日本の地域別将来推計人口」（令和5(2023)年推計）。公的推計の公表値をそのまま
  // 収録し、自前の推計・按分はしない。減少率・高齢化率などの派生値は保存せず実行時算出
  //（lib/futurePopulation.ts）。対象外（福島浜通り13市町村・北方領土6村・浜松市の
  // 再編後2区）は数値0 + source センチネル（hasFuturePopulation 参照）。
  // 基準人口 base2020 は2020年国勢調査ベースで、population（2025年国勢調査）とは
  // 調査基準が異なる。減少率は必ず base2020 を分母にする。
  futurePopulation?: {
    base2020: number;                 // 推計の基準人口（2020年）
    total: Record<string, number>;    // { "2025": n, ..., "2050": n }（5年刻み）
    young2050: number;                // 2050年 0-14歳
    working2050: number;              // 2050年 15-64歳
    elderly2050: number;              // 2050年 65歳以上
    source: string;
    asOf: string;                     // "2023"（令和5年推計）
  };
  hazard: HazardInfo;
  amenities?: {
    stations: number;            // 駅数
    preschools: number;          // 保育園・幼稚園・認定こども園 合計
    medicalFacilities: number;   // 医療機関（病院・診療所等）合計
    source: string;
    asOf: string;
  };
  // 財政力指数（総務省「地方公共団体の主要財政指標一覧」・3か年平均・小数2桁）。
  // 経常収支比率等は制度説明なしに誤読リスクが高いため収録しない（1指標に絞る。
  // 出典の同一行にあるため後日の拡張コストはほぼゼロ）。
  // センチネル: 出典に行がない北方領土6村は index=-1（指数は正値のみなので安全。
  // lib/fiscal.ts hasFiscal 参照）。政令市の区は市単位の値を source「（○○市全体の値）」
  // 付きで展開（childcare と同方式）。東京23特別区は都区財政調整制度下の算定のため
  // source に明記し、ランキング対象外（lib/fiscal.ts isFiscalRankable）。
  fiscal?: {
    index: number;   // 財政力指数
    source: string;
    asOf: string;    // "2024年度"（令和6年度。R4-R6の3か年平均）
  };
  // 指定緊急避難場所の件数サマリ（点の座標は別ファイル data/{slug}_shelters.json に置き
  // 地図選択時に /api/shelters/[code] で取得する）。未収録は source にセンチネルを持つ
  // （lib/shelters.ts hasShelterData 参照）。詳細パネルの件数表示用。
  shelters?: {
    count: number;               // 自治体内の指定緊急避難場所の総数
    source: string;
    asOf: string;
  };
};

// 地図ページ（/map・/map/*）の初期配信用の軽量サマリ。検索・地図の色付け・自治体分割に
// 必要な最小フィールドのみ（全1923自治体ぶんを積んでも軽い）。詳細は選択時に
// /api/muni/[code] でフル Municipality を取得する。
export type MuniSummary = {
  code: string;
  pref: string;
  name: string;
  displayName?: string;
  // ひらがな読み（検索のかな一致用）。data/muni-kana.json（Geolonia 住所データ由来、
  // 政令市親市は区の読みから導出）を listSummaryAcrossPrefs で合流させる。
  kana?: string;
  level?: AdminLevel;
  parentCode?: string;
  rent: number;          // rent.value（円/月）
  landPrice: number;     // landPrice.value（円/㎡）。<=0 はデータなし
  populationTrend: Municipality["populationTrend"]; // 人口トレンド（地図の塗り分け用）
  // 在留外国人の人口比（%）。地図の塗り分け用。-1=データなし（北方領土等の対象外／
  // 人口不明）。0% は実データ（lib/foreignResidents.ts foreignRatioPct で算出）。
  foreignRatio: number;
  // 2020→2050年の将来推計人口の増減率（%・IPSS 令和5年推計）。地図の塗り分け用。
  // 減少（負値）が正常値のため負のセンチネルは使えず、データなし（対象外）は
  // フィールド欠落で表現する（lib/futurePopulation.ts futureChangeRate2050 で算出）。
  futureChangeRate?: number;
  // 空き家率（%・住宅・土地統計調査）。地図の塗り分け用。データなし（人口1.5万人
  // 未満の町村など集計対象外）はフィールド欠落で表現する（futureChangeRate と同方式。
  // 0% が理論上実データになり得るため 0 センチネルは使わない）。
  vacancyRate?: number;
  // 浸水深ランク。-1=評価対象外（reinfolib圏外）, 0=なし, 1..6（lib/hazardScale.ts）。
  // 旧 hasFloodRisk(>0)・hazardEvaluated(>=0) を1フィールドに集約。地図の濃淡と
  // 「浸水深◯m以下」フィルタの単一ソース。
  floodLevel: number;
  // 地図のハザード・オーバーレイ切替（lib/mapHazards.ts）用の数値レベルのみ。
  // ラベル/深さ文字列は詳細ページ（フル Municipality）側に置きサマリは軽量に保つ。
  landslideLevel: number;     // -1=対象外, 0=なし, 1=警戒区域, 2=特別警戒区域
  tsunamiLevel: number;       // -1=対象外, 0=想定なし, 1..8（深いほど高リスク）
  stormSurgeLevel: number;    // 同上
  liquefactionLevel: number;  // -1=未評価, 1..5（小さいほど高リスク）
};
