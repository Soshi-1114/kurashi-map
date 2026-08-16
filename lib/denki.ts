// 電気料金シミュレーター（/denki）のドメインモジュール。
//
// - 供給エリア判定: 市区町村コード → 一般送配電事業者10エリア。
//   基本は県（コード先頭2桁）→エリアの1:1で、県内でエリアが分かれる
//   境界自治体だけを AREA_EXCEPTIONS に手動整備する（lib/prefs.ts と同じ
//   「小さな手動メタデータは TS 定数」の流儀。出典は各エントリに併記）。
// - 料金プランデータ: data/denki-plans.json（手動整備）。型と整合性検証を
//   ここに集約し、実 JSON はテスト（tests/lib/denkiPlans.test.ts）で検証する。
//
// honesty 方針: 自治体内で供給エリアが分かれる場合は断定せず altArea + note で
// 「分かれる」事実を UI に渡す。試算に含まれない費目（燃料費調整額・再エネ
// 賦課金）はプラン側の注記と UI の前提条件ボックスで必ず明示する。

import plansJson from "../data/denki-plans.json";

/** 一般送配電事業者の供給エリア（全国10エリア）。 */
export type DenkiArea =
  | "hokkaido"
  | "tohoku"
  | "tokyo"
  | "chubu"
  | "hokuriku"
  | "kansai"
  | "chugoku"
  | "shikoku"
  | "kyushu"
  | "okinawa";

export const DENKI_AREAS: DenkiArea[] = [
  "hokkaido",
  "tohoku",
  "tokyo",
  "chubu",
  "hokuriku",
  "kansai",
  "chugoku",
  "shikoku",
  "kyushu",
  "okinawa",
];

/** エリアの表示名（一般送配電事業者名ではなく利用者に通じる旧一般電気事業者ベースの通称）。 */
export const DENKI_AREA_LABELS: Record<DenkiArea, string> = {
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
};

// 県（全国地方公共団体コード先頭2桁）→ エリアの既定マッピング。
// 新潟県(15)は東北電力エリア、山梨県(19)は東京電力エリアである点に注意。
// 県内で分かれる自治体は AREA_EXCEPTIONS 側で上書きする。
export const PREF_TO_AREA: Record<string, DenkiArea> = {
  "01": "hokkaido",
  "02": "tohoku",
  "03": "tohoku",
  "04": "tohoku",
  "05": "tohoku",
  "06": "tohoku",
  "07": "tohoku",
  "08": "tokyo",
  "09": "tokyo",
  "10": "tokyo",
  "11": "tokyo",
  "12": "tokyo",
  "13": "tokyo",
  "14": "tokyo",
  "15": "tohoku",
  "16": "hokuriku",
  "17": "hokuriku",
  "18": "hokuriku",
  "19": "tokyo",
  "20": "chubu",
  "21": "chubu",
  "22": "chubu",
  "23": "chubu",
  "24": "chubu",
  "25": "kansai",
  "26": "kansai",
  "27": "kansai",
  "28": "kansai",
  "29": "kansai",
  "30": "kansai",
  "31": "chugoku",
  "32": "chugoku",
  "33": "chugoku",
  "34": "chugoku",
  "35": "chugoku",
  "36": "shikoku",
  "37": "shikoku",
  "38": "shikoku",
  "39": "shikoku",
  "40": "kyushu",
  "41": "kyushu",
  "42": "kyushu",
  "43": "kyushu",
  "44": "kyushu",
  "45": "kyushu",
  "46": "kyushu",
  "47": "okinawa",
};

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
  /** エリアの表示名（DENKI_AREA_LABELS[area]） */
  label: string;
  /** 自治体内の一部地域が別エリアの場合のもう一方 */
  altArea?: DenkiArea;
  /** 分かれ方の説明（altArea があるときのみ） */
  note?: string;
};

/**
 * 市区町村コード（5桁）から供給エリアを判定する。
 * 政令市の行政区コードも先頭2桁で県に解決できるため同じ経路で判定できる
 * （区単位の例外が必要になったら AREA_EXCEPTIONS に区コードで追加する）。
 * 不明なコードは null。
 */
export function areaForMuni(code: string): AreaResult | null {
  if (!/^\d{5}$/.test(code)) return null;
  const ex = AREA_EXCEPTIONS[code];
  if (ex) {
    return { area: ex.area, label: DENKI_AREA_LABELS[ex.area], altArea: ex.altArea, note: ex.note };
  }
  const area = PREF_TO_AREA[code.slice(0, 2)];
  if (!area) return null;
  return { area, label: DENKI_AREA_LABELS[area] };
}

// ---------------------------------------------------------------------------
// 料金プランデータ（data/denki-plans.json）の型と検証
// ---------------------------------------------------------------------------

/** 基本料金。アンペア制（東日本・中部・北陸・九州の従量電灯B型）か最低料金制（関西・中国・四国・沖縄の従量電灯A型）。 */
export type DenkiBasicCharge =
  | { type: "ampere"; yenPerMonth: { "30": number; "40": number; "50": number } }
  | { type: "minimum"; yenPerMonth: number; includedKwh: number };

/** 従量料金の段階。upTo は月間使用量の上限 kWh（最終段階は null = 上限なし）。 */
export type DenkiTier = { upTo: number | null; yenPerKwh: number };

export type DenkiAreaPricing = { basic: DenkiBasicCharge; tiers: DenkiTier[] };

export type DenkiPlan = {
  /** env のアフィリエイトリンク設定と対応する一意 ID（baseline は対応不要） */
  offerId: string;
  company: string;
  planName: string;
  /** baseline = 大手電力の規制料金（比較の基準）。offer = 送客対象の新電力プラン */
  kind: "baseline" | "offer";
  areas: Partial<Record<DenkiArea, DenkiAreaPricing>>;
  officialUrl: string;
  /** 料金表の出典ページ（officialUrl と同一でも可） */
  sourceUrl: string;
  /** 料金表を確認した時点（YYYY-MM-DD または YYYY-MM） */
  sourceAsOf: string;
  notes?: string[];
};

export type DenkiPlansFile = { asOf: string; plans: DenkiPlan[] };

/** data/denki-plans.json（検証はテストで実施済みの前提で型キャストする）。 */
export function getDenkiPlans(): DenkiPlansFile {
  return plansJson as DenkiPlansFile;
}

/**
 * プランデータの整合性検証。違反を文字列の配列で返す（空配列 = OK）。
 * 実 JSON はテストで常時検証し、手動整備ミス（baseline 欠落・単価 0・
 * offerId 重複など）を CI で捕まえる。
 */
export function validateDenkiPlans(file: DenkiPlansFile): string[] {
  const errors: string[] = [];
  if (!/^\d{4}-\d{2}$/.test(file.asOf)) errors.push(`asOf が YYYY-MM 形式でない: ${file.asOf}`);

  const ids = new Set<string>();
  const baselineAreas = new Set<DenkiArea>();

  for (const plan of file.plans) {
    const p = `plans[${plan.offerId}]`;
    if (ids.has(plan.offerId)) errors.push(`offerId が重複: ${plan.offerId}`);
    ids.add(plan.offerId);
    if (plan.kind !== "baseline" && plan.kind !== "offer") errors.push(`${p}: kind が不正: ${plan.kind}`);
    if (!/^https?:\/\//.test(plan.officialUrl)) errors.push(`${p}: officialUrl が URL でない`);
    if (!/^https?:\/\//.test(plan.sourceUrl)) errors.push(`${p}: sourceUrl が URL でない`);
    if (!/^\d{4}-\d{2}(-\d{2})?$/.test(plan.sourceAsOf)) errors.push(`${p}: sourceAsOf が日付形式でない: ${plan.sourceAsOf}`);

    const areaKeys = Object.keys(plan.areas) as DenkiArea[];
    if (areaKeys.length === 0) errors.push(`${p}: areas が空`);
    for (const area of areaKeys) {
      if (!DENKI_AREAS.includes(area)) {
        errors.push(`${p}: 不明なエリア: ${area}`);
        continue;
      }
      if (plan.kind === "baseline") {
        if (baselineAreas.has(area)) errors.push(`エリア ${area} に baseline が複数ある`);
        baselineAreas.add(area);
      }
      const pricing = plan.areas[area]!;
      const pa = `${p}.areas.${area}`;
      const basic = pricing.basic;
      if (basic.type === "ampere") {
        for (const a of ["30", "40", "50"] as const) {
          if (!(basic.yenPerMonth[a] > 0)) errors.push(`${pa}: 基本料金 ${a}A が正でない`);
        }
      } else if (basic.type === "minimum") {
        if (!(basic.yenPerMonth > 0)) errors.push(`${pa}: 最低料金が正でない`);
        if (!(basic.includedKwh >= 0)) errors.push(`${pa}: includedKwh が不正`);
      } else {
        errors.push(`${pa}: basic.type が不正`);
      }
      if (pricing.tiers.length === 0) errors.push(`${pa}: tiers が空`);
      let prev = 0;
      pricing.tiers.forEach((t, i) => {
        const last = i === pricing.tiers.length - 1;
        if (!(t.yenPerKwh > 0)) errors.push(`${pa}: tiers[${i}] の単価が正でない`);
        if (last) {
          if (t.upTo !== null) errors.push(`${pa}: 最終段階の upTo は null であるべき`);
        } else {
          if (t.upTo === null || !(t.upTo > prev)) errors.push(`${pa}: tiers[${i}] の upTo が昇順でない`);
          else prev = t.upTo;
        }
      });
    }
  }

  for (const area of DENKI_AREAS) {
    if (!baselineAreas.has(area)) errors.push(`エリア ${area} の baseline がない`);
  }
  return errors;
}
