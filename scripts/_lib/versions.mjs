// 年度依存のデータ出典バージョンの「単一ソース」。
//
// 従来これらの値は annual ワークフローの env ブロックと各 fetch スクリプトの
// ハードコード既定（例: `process.env.L01_VERSION || "26"`）に二重定義されており、
// 片方だけ更新して同期がずれる事故が起きやすかった（実際 fetch-shelters.mjs の
// 既定 ASOF は "2025" のままワークフローが "2026-06-19" を渡す状態になっていた）。
//
// ここを唯一の真実として:
//   - 各スクリプトは env 未設定時の既定として VERSIONS を読む。
//   - annual ワークフローは「バージョン設定を読み込み」ステップでこのファイルを
//     $GITHUB_ENV に展開し、bash ステップ（curl URL 等）でも同じ値を使う。
//
// 年度更新の手順は docs/data-update.md を参照。URL と ASOF は必ずセットで更新すること。
export const VERSIONS = {
  // 国土数値情報 L01 地価公示。VERSION=zip 版番号（例 26=令和8年公示）、
  // ASOF=出典表示の年。必ず同期させる（VERSION=26 なら ASOF=2026）。
  L01_VERSION: "26",
  L01_ASOF: "2026",

  // こども家庭庁「保育所等関連状況取りまとめ」待機児童 Excel。
  // URL 末尾の採番（_r7_02）は年度で変わり自動推測できないため、公表ページで確認して
  // 手動更新する（docs/data-update.md §待機児童）。CFA_ASOF（令和7年=2025-04-01）と必ず同期。
  CFA_XLSX_URL:
    "https://www.cfa.go.jp/assets/contents/node/basic_page/field_ref_resources/b0a8057b-34bf-4c20-84fb-ae592708ca9b/1a728dcc/20250828_policies_hoiku_torimatome_r7_02.xlsx",
  CFA_ASOF: "2025-04-01",

  // 国土地理院「指定緊急避難場所データ」全国版 CSV（mergeFromCity_2 = 指定緊急避難場所）。
  // 空文字にすると annual ワークフローの避難場所ステップはスキップ（警告のみ）。
  // GSI_SHELTER_ASOF は公開更新時の基準時点。URL と必ず同期（docs/data-update.md §避難場所）。
  GSI_SHELTER_URL: "https://hinanmap.gsi.go.jp/hinanjocp/defaultFtpData/csv/mergeFromCity_2.csv",
  GSI_SHELTER_ASOF: "2026-06-19",

  // 出入国在留管理庁「在留外国人統計」の基準時点（半期公表・手動更新）。
  // 期を更新したら statInfId とセットで合わせる（docs/data-update.md §在留外国人）。
  FOREIGN_ASOF: "2025-06",

  // 厚生労働省「医療施設調査」（e-Stat）市区町村別の statsDataId。年度ごとに**新しい表**が
  // 追加される（同一IDの更新ではない）ため、毎年 e-Stat で最新年の表IDを確認して差し替える。
  // 第1表=病院数（二次医療圏・市区町村別）/ 第2表=一般診療所数・歯科診療所数（同）。
  // MEDICAL_ASOF は調査基準時点（毎年10月1日）。表IDと必ず同期させる。
  MEDICAL_HOSP_STATSDATAID: "0004048437",
  MEDICAL_CLINIC_STATSDATAID: "0004048438",
  MEDICAL_ASOF: "2024年10月",

  // 国土数値情報「駅別乗降客数 S12」全国 GML zip（GeoJSON 同梱）。年度版は例年4月公開で、
  // URL の S12-{NN} を新年度に差し替える（fetch-stations.mjs, annual）。
  // S12_ASOF は駅セットの整備年度。URL と必ず同期（AMENITIES_ASOF の駅部分も更新）。
  S12_URL: "https://nlftp.mlit.go.jp/ksj/gml/data/S12/S12-24/S12-24_GML.zip",
  S12_ASOF: "2024年度",

  // 生活インフラ（amenities）の共通表示ラベル。駅=S12 直接（annual, fetch-stations.mjs）、
  // 保育=reinfolib XKT007（quarterly, fetch-amenities.mjs）、医療機関=医療施設調査
  // （annual, fetch-medical.mjs）と出典・年度が異なるため3つを明示。3スクリプトが
  // このラベルを書く（表示の同期）。S12_ASOF / MEDICAL_ASOF を更新したら
  // AMENITIES_ASOF の該当部分も合わせる（テストで検査）。
  AMENITIES_SOURCE: "国土数値情報（S12 駅・reinfolib XKT007 保育）・厚生労働省 医療施設調査",
  AMENITIES_ASOF: "駅 2024年度／保育 令和5年度／医療機関 2024年10月",
};

// env 未設定なら VERSIONS の既定を返すヘルパー。スクリプトからの読み出しを1行にする。
export function version(key) {
  const v = process.env[key];
  return v !== undefined && v !== "" ? v : VERSIONS[key];
}
