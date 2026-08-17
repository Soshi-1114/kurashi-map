// 電気の供給エリア判定（市区町村コード → 一般送配電事業者10エリア）。
//
// 基本は県（コード先頭2桁）→エリアの1:1で、県内でエリアが分かれる境界自治体
// だけを AREA_EXCEPTIONS に手動整備する（lib/prefs.ts と同じ「小さな手動
// メタデータは TS 定数」の流儀。出典は各エントリに併記）。
//
// 料金プランデータ（data/denki-plans.json）は lib/denkiPlans.ts が担当。
// エリア判定だけを使うページ（自治体詳細の導線など）が料金 JSON を
// バンドルに引き込まないよう、このモジュールはデータ import を持たない。
//
// honesty 方針: 自治体内で供給エリアが分かれる場合は断定せず altArea + note で
// 「分かれる」事実を UI に渡す。

// エリアの表示名（一般送配電事業者名ではなく利用者に通じる旧一般電気事業者
// ベースの通称）。この Record が10エリアの単一の正典で、型・一覧は導出する。
export const DENKI_AREA_LABELS = {
  hokkaido: "北海道電力エリア",
  tohoku: "東北電力エリア",
  tokyo: "東京電力エリア",
  chubu: "中部電力エリア",
  hokuriku: "北陸電力エリア",
  kansai: "関西電力エリア",
  chugoku: "中国電力エリア",
  shikoku: "四国電力エリア",
  kyushu: "九州電力エリア",
  okinawa: "沖縄電力エリア",
} as const;

/** 一般送配電事業者の供給エリア（全国10エリア）。 */
export type DenkiArea = keyof typeof DENKI_AREA_LABELS;

/** 10エリアの一覧（Record のキー宣言順 = 北→南）。 */
export const DENKI_AREAS = Object.keys(DENKI_AREA_LABELS) as DenkiArea[];

// エリア → 県プレフィックス（全国地方公共団体コード先頭2桁）の既定マッピング。
// 新潟県(15)は東北電力エリア、山梨県(19)は東京電力エリアである点に注意。
// 県内で分かれる自治体は AREA_EXCEPTIONS 側で上書きする。
const AREA_PREFIXES: Record<DenkiArea, string[]> = {
  hokkaido: ["01"],
  tohoku: ["02", "03", "04", "05", "06", "07", "15"],
  tokyo: ["08", "09", "10", "11", "12", "13", "14", "19"],
  chubu: ["20", "21", "22", "23", "24"],
  hokuriku: ["16", "17", "18"],
  kansai: ["25", "26", "27", "28", "29", "30"],
  chugoku: ["31", "32", "33", "34", "35"],
  shikoku: ["36", "37", "38", "39"],
  kyushu: ["40", "41", "42", "43", "44", "45", "46"],
  okinawa: ["47"],
};

/** 県プレフィックス → エリアの逆引き（AREA_PREFIXES から導出）。 */
export const PREF_TO_AREA: Record<string, DenkiArea> = Object.fromEntries(
  DENKI_AREAS.flatMap((area) => AREA_PREFIXES[area].map((px) => [px, area])),
);

/**
 * 県既定から外れる境界自治体。
 * - area: この自治体の主たる供給エリア（県既定と異なる場合に上書き）
 * - altArea: 自治体内の一部地域だけが別エリアの場合のもう一方
 * - note: どの地区が分かれるか（UI にそのまま表示する説明文）
 * - source: 確認した公式ページ URL
 */
export type AreaException = {
  area: DenkiArea;
  altArea?: DenkiArea;
  note?: string;
  source: string;
};

// 2026-08-16 調査。各一般送配電事業者の公式ページ（停電情報の対象市町村一覧・FAQ）で確認
// できた市区町村レベルの例外のみ収録。字レベルの越境供給（新潟県糸魚川市西部の60Hz地区、
// 愛媛県新居浜市別子山の住友共同電力供給など）は公式で市区町村単位の確認が取れないか
// 10エリア外のため収録しない（該当自治体は県既定のまま）。
const CHUDEN_SHIZUOKA = "https://teiden.powergrid.chuden.co.jp/p/sizuoka.html";
const CHUDEN_MIE = "https://teiden.powergrid.chuden.co.jp/p/mie.html";
const RIKUDEN_GIFU = "https://www.rikuden.co.jp/nw/teiden/f1/now/otj040_21.html";
const RIKUDEN_FUKUI = "https://www.rikuden.co.jp/nw/teiden/f1/now/otj040_18.html";
const KANSAI_TD_FAQ = "https://www.kansai-td.co.jp/faq/1/1/q10028521.html";
const ENERGIA_NW_FAQ = "https://www.energia.co.jp/nw/faq/teidenapuri/";

export const AREA_EXCEPTIONS: Record<string, AreaException> = {
  // --- 静岡県: 富士川以東は東京電力エリア（全域が東京側の18市町） ---
  "22203": { area: "tokyo", source: CHUDEN_SHIZUOKA }, // 沼津市
  "22205": { area: "tokyo", source: CHUDEN_SHIZUOKA }, // 熱海市
  "22206": { area: "tokyo", source: CHUDEN_SHIZUOKA }, // 三島市
  "22208": { area: "tokyo", source: CHUDEN_SHIZUOKA }, // 伊東市
  "22215": { area: "tokyo", source: CHUDEN_SHIZUOKA }, // 御殿場市
  "22219": { area: "tokyo", source: CHUDEN_SHIZUOKA }, // 下田市
  "22220": { area: "tokyo", source: CHUDEN_SHIZUOKA }, // 裾野市
  "22222": { area: "tokyo", source: CHUDEN_SHIZUOKA }, // 伊豆市
  "22225": { area: "tokyo", source: CHUDEN_SHIZUOKA }, // 伊豆の国市
  "22301": { area: "tokyo", source: CHUDEN_SHIZUOKA }, // 東伊豆町
  "22302": { area: "tokyo", source: CHUDEN_SHIZUOKA }, // 河津町
  "22304": { area: "tokyo", source: CHUDEN_SHIZUOKA }, // 南伊豆町
  "22305": { area: "tokyo", source: CHUDEN_SHIZUOKA }, // 松崎町
  "22306": { area: "tokyo", source: CHUDEN_SHIZUOKA }, // 西伊豆町
  "22325": { area: "tokyo", source: CHUDEN_SHIZUOKA }, // 函南町
  "22341": { area: "tokyo", source: CHUDEN_SHIZUOKA }, // 清水町
  "22342": { area: "tokyo", source: CHUDEN_SHIZUOKA }, // 長泉町
  "22344": { area: "tokyo", source: CHUDEN_SHIZUOKA }, // 小山町
  // --- 静岡県: 市域内で分かれる2市 ---
  "22210": {
    // 富士市
    area: "tokyo",
    altArea: "chubu",
    note: "旧富士川町区域（富士川以西）は中部電力エリア",
    source: CHUDEN_SHIZUOKA,
  },
  "22207": {
    // 富士宮市
    area: "tokyo",
    altArea: "chubu",
    note: "旧芝川町の内房地区は中部電力エリア",
    source: CHUDEN_SHIZUOKA,
  },
  // --- 岐阜県 ---
  "21217": {
    // 飛騨市
    area: "chubu",
    altArea: "hokuriku",
    note: "旧神岡町区域と宮川町の一部は北陸電力エリア",
    source: RIKUDEN_GIFU,
  },
  "21219": {
    // 郡上市
    area: "chubu",
    altArea: "hokuriku",
    note: "白鳥町石徹白は北陸電力エリア",
    source: RIKUDEN_GIFU,
  },
  "21362": {
    // 関ケ原町
    area: "chubu",
    altArea: "kansai",
    note: "今須地区は関西電力エリア",
    source: KANSAI_TD_FAQ,
  },
  // --- 三重県: 熊野川流域は関西電力エリア ---
  "24212": {
    // 熊野市
    area: "kansai",
    altArea: "chubu",
    note: "新鹿町・大泊町など旧新鹿・荒坂・泊村区域は中部電力エリア",
    source: CHUDEN_MIE,
  },
  "24561": { area: "kansai", source: CHUDEN_MIE }, // 御浜町
  "24562": { area: "kansai", source: CHUDEN_MIE }, // 紀宝町
  // --- 福井県: 嶺南の5市町は関西電力エリア（敦賀市は北陸側のまま） ---
  "18204": { area: "kansai", source: RIKUDEN_FUKUI }, // 小浜市
  "18442": { area: "kansai", source: RIKUDEN_FUKUI }, // 美浜町
  "18481": { area: "kansai", source: RIKUDEN_FUKUI }, // 高浜町
  "18483": { area: "kansai", source: RIKUDEN_FUKUI }, // おおい町
  "18501": { area: "kansai", source: RIKUDEN_FUKUI }, // 若狭町
  // --- 兵庫県 ---
  "28212": {
    // 赤穂市
    area: "kansai",
    altArea: "chugoku",
    note: "福浦地区は中国電力エリア",
    source: ENERGIA_NW_FAQ,
  },
  // --- 香川県: 小豆郡・香川郡は中国電力エリア ---
  "37322": { area: "chugoku", source: ENERGIA_NW_FAQ }, // 土庄町
  "37324": { area: "chugoku", source: ENERGIA_NW_FAQ }, // 小豆島町
  "37364": { area: "chugoku", source: ENERGIA_NW_FAQ }, // 直島町
  // --- 愛媛県: 越智郡と今治市の島嶼部は中国電力エリア ---
  "38356": { area: "chugoku", source: ENERGIA_NW_FAQ }, // 上島町
  "38202": {
    // 今治市
    area: "shikoku",
    altArea: "chugoku",
    note: "旧越智郡の島嶼部（しまなみ海道沿いの島々）は中国電力エリア",
    source: ENERGIA_NW_FAQ,
  },
};

export type AreaResult = {
  area: DenkiArea;
  /** 自治体内の一部地域が別エリアの場合のもう一方 */
  altArea?: DenkiArea;
  /** 分かれ方の説明（altArea があるときのみ） */
  note?: string;
  /** 例外エリアの確認元 URL（AREA_EXCEPTIONS 由来のときのみ） */
  source?: string;
};

/**
 * 市区町村コード（5桁）から供給エリアを判定する。
 * 政令市の行政区コードも先頭2桁で県に解決できるため同じ経路で判定できる
 * （区単位の例外が必要になったら AREA_EXCEPTIONS に区コードで追加する）。
 * 不明なコードは null。表示名は DENKI_AREA_LABELS[area] で引く。
 */
export function areaForMuni(code: string): AreaResult | null {
  if (!/^\d{5}$/.test(code)) return null;
  const ex = AREA_EXCEPTIONS[code];
  if (ex) return { area: ex.area, altArea: ex.altArea, note: ex.note, source: ex.source };
  const area = PREF_TO_AREA[code.slice(0, 2)];
  return area ? { area } : null;
}

/**
 * 自治体プリセット付きの /denki URL。受け側は app/denki の DenkiSimulator が
 * `?code=` として読む（URL 契約の生成側をここに一元化）。
 */
export function denkiUrlForMuni(code: string): string {
  return `/denki?code=${code}`;
}
