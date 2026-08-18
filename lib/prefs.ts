// 対応都道府県マニフェスト（純粋なメタデータ）。
// 新規県を追加する時はここに entry を 1 行足し、data/{slug}.json と
// （政令市があれば）data/{slug}_wards.json + public/{slug}.geojson + 必要なら
// public/{slug}_wards.geojson を準備する。

import type { Municipality } from "./types";

export type PrefEntry = {
  slug: string;
  nameJa: string;
  /** 全国地方公共団体コードの先頭 2 桁 */
  codePrefix: string;
  /** 政令市の行政区 wards.json を持っているか */
  hasWards: boolean;
  /**
   * 地図の初期フォーカス用 bbox [west, south, east, north]。値は scripts/_lib/prefs.mjs の
   * bbox と同一（ドリフトは tests/lib/prefs.test.ts が検出）。ジオメトリ全体の bbox と違い
   * 島嶼を除いた本土中心（東京=本土＋多摩のみ等）。選定理由は prefs.mjs 側のコメント参照。
   */
  bbox: [number, number, number, number];
};

// 各 pref データのローダ。テンプレートリテラルの動的 import なので Next.js の
// コード分割が効き、必要時のみ該当 pref の chunk が読み込まれる（全47県を
// ホームページに乗せない）。
export async function loadPrefData(
  slug: string,
  hasWards: boolean,
): Promise<{ muni: Municipality[]; wards: Municipality[] }> {
  try {
    const muni = (await import(`../data/${slug}.json`)).default as Municipality[];
    const wards = hasWards
      ? ((await import(`../data/${slug}_wards.json`)).default as Municipality[])
      : [];
    return { muni, wards };
  } catch (e) {
    // データファイル欠落はここで文脈を付けて大声で失敗させる（黙って空配列を返すと
    // SSG が該当県のページを静かに生成しなくなり、欠損に気づけない）。
    throw new Error(
      `pref データの読み込みに失敗: ${slug} (hasWards=${hasWards}) — data/${slug}.json を確認してください: ${String(e)}`,
    );
  }
}

export const PREFS: PrefEntry[] = [
  { slug: "saitama", nameJa: "埼玉県", codePrefix: "11", hasWards: true, bbox: [138.71, 35.74, 139.91, 36.29] },
  { slug: "chiba", nameJa: "千葉県", codePrefix: "12", hasWards: true, bbox: [139.74, 34.9, 140.88, 36.1] },
  { slug: "gunma", nameJa: "群馬県", codePrefix: "10", hasWards: false, bbox: [138.397, 35.985, 139.67, 37.059] },
  { slug: "tochigi", nameJa: "栃木県", codePrefix: "09", hasWards: false, bbox: [139.327, 36.201, 140.292, 37.155] },
  { slug: "ibaraki", nameJa: "茨城県", codePrefix: "08", hasWards: false, bbox: [139.688, 35.739, 140.852, 36.945] },
  { slug: "tokyo", nameJa: "東京都", codePrefix: "13", hasWards: false, bbox: [138.93, 35.49, 139.95, 35.9] },
  { slug: "kanagawa", nameJa: "神奈川県", codePrefix: "14", hasWards: true, bbox: [138.916, 35.129, 139.836, 35.673] },
  { slug: "yamanashi", nameJa: "山梨県", codePrefix: "19", hasWards: false, bbox: [138.18, 35.168, 139.134, 35.972] },
  { slug: "nagano", nameJa: "長野県", codePrefix: "20", hasWards: false, bbox: [137.325, 35.198, 138.739, 37.03] },
  { slug: "gifu", nameJa: "岐阜県", codePrefix: "21", hasWards: false, bbox: [136.276, 35.134, 137.653, 36.465] },
  { slug: "shizuoka", nameJa: "静岡県", codePrefix: "22", hasWards: true, bbox: [137.474, 34.572, 139.177, 35.646] },
  { slug: "aichi", nameJa: "愛知県", codePrefix: "23", hasWards: true, bbox: [136.671, 34.574, 137.838, 35.425] },
  { slug: "mie", nameJa: "三重県", codePrefix: "24", hasWards: false, bbox: [135.853, 33.723, 136.99, 35.258] },
  { slug: "shiga", nameJa: "滋賀県", codePrefix: "25", hasWards: false, bbox: [135.764, 34.791, 136.455, 35.704] },
  { slug: "kyoto", nameJa: "京都府", codePrefix: "26", hasWards: true, bbox: [134.854, 34.706, 136.055, 35.779] },
  { slug: "osaka", nameJa: "大阪府", codePrefix: "27", hasWards: true, bbox: [135.091, 34.272, 135.747, 35.051] },
  { slug: "hyogo", nameJa: "兵庫県", codePrefix: "28", hasWards: true, bbox: [134.253, 34.155, 135.469, 35.675] },
  { slug: "nara", nameJa: "奈良県", codePrefix: "29", hasWards: false, bbox: [135.54, 33.859, 136.23, 34.781] },
  { slug: "wakayama", nameJa: "和歌山県", codePrefix: "30", hasWards: false, bbox: [134.999, 33.433, 136.013, 34.384] },
  { slug: "tottori", nameJa: "鳥取県", codePrefix: "31", hasWards: false, bbox: [133.136, 35.058, 134.515, 35.615] },
  { slug: "shimane", nameJa: "島根県", codePrefix: "32", hasWards: false, bbox: [131.668, 34.302, 133.391, 37.248] },
  { slug: "okayama", nameJa: "岡山県", codePrefix: "33", hasWards: true, bbox: [133.267, 34.298, 134.413, 35.353] },
  { slug: "hiroshima", nameJa: "広島県", codePrefix: "34", hasWards: true, bbox: [132.036, 34.028, 133.471, 35.106] },
  { slug: "yamaguchi", nameJa: "山口県", codePrefix: "35", hasWards: false, bbox: [130.775, 33.713, 132.492, 34.799] },
  { slug: "tokushima", nameJa: "徳島県", codePrefix: "36", hasWards: false, bbox: [133.661, 33.539, 134.822, 34.252] },
  { slug: "kagawa", nameJa: "香川県", codePrefix: "37", hasWards: false, bbox: [133.447, 34.012, 134.447, 34.565] },
  { slug: "ehime", nameJa: "愛媛県", codePrefix: "38", hasWards: false, bbox: [132.012, 32.885, 133.693, 34.302] },
  { slug: "kochi", nameJa: "高知県", codePrefix: "39", hasWards: false, bbox: [132.48, 32.703, 134.315, 33.883] },
  { slug: "fukuoka", nameJa: "福岡県", codePrefix: "40", hasWards: true, bbox: [129.981, 33, 131.191, 34.25] },
  { slug: "saga", nameJa: "佐賀県", codePrefix: "41", hasWards: false, bbox: [129.737, 32.95, 130.542, 33.619] },
  { slug: "nagasaki", nameJa: "長崎県", codePrefix: "42", hasWards: false, bbox: [128.104, 31.967, 130.39, 34.729] },
  { slug: "kumamoto", nameJa: "熊本県", codePrefix: "43", hasWards: true, bbox: [129.939, 32.095, 131.33, 33.195] },
  { slug: "oita", nameJa: "大分県", codePrefix: "44", hasWards: false, bbox: [130.825, 32.714, 132.177, 33.74] },
  { slug: "miyazaki", nameJa: "宮崎県", codePrefix: "45", hasWards: false, bbox: [130.703, 31.356, 131.886, 32.839] },
  { slug: "kagoshima", nameJa: "鹿児島県", codePrefix: "46", hasWards: false, bbox: [129.415, 30, 131.205, 32.311] },
  { slug: "okinawa", nameJa: "沖縄県", codePrefix: "47", hasWards: false, bbox: [126.708, 26.074, 128.336, 27.101] },
  { slug: "aomori", nameJa: "青森県", codePrefix: "02", hasWards: false, bbox: [139.497, 40.218, 141.683, 41.556] },
  { slug: "iwate", nameJa: "岩手県", codePrefix: "03", hasWards: false, bbox: [140.653, 38.748, 142.072, 40.45] },
  { slug: "miyagi", nameJa: "宮城県", codePrefix: "04", hasWards: true, bbox: [140.275, 37.773, 141.677, 39.003] },
  { slug: "akita", nameJa: "秋田県", codePrefix: "05", hasWards: false, bbox: [139.692, 38.873, 140.995, 40.511] },
  { slug: "yamagata", nameJa: "山形県", codePrefix: "06", hasWards: false, bbox: [139.52, 37.734, 140.646, 39.216] },
  { slug: "fukushima", nameJa: "福島県", codePrefix: "07", hasWards: false, bbox: [139.165, 36.791, 141.046, 37.977] },
  { slug: "niigata", nameJa: "新潟県", codePrefix: "15", hasWards: true, bbox: [137.635, 36.737, 139.9, 38.554] },
  { slug: "toyama", nameJa: "富山県", codePrefix: "16", hasWards: false, bbox: [136.768, 36.274, 137.763, 36.983] },
  { slug: "ishikawa", nameJa: "石川県", codePrefix: "17", hasWards: false, bbox: [136.242, 36.067, 137.365, 37.858] },
  { slug: "fukui", nameJa: "福井県", codePrefix: "18", hasWards: false, bbox: [135.449, 35.344, 136.832, 36.297] },
  { slug: "hokkaido", nameJa: "北海道", codePrefix: "01", hasWards: true, bbox: [139.334, 41.352, 148.894, 45.557] },
];

// 地方区分（全国地方公共団体コード先頭2桁で機械的に分類）。PREFS の並びは
// データ整備順なので、UI で「全国の都道府県が分類なしに並ぶ」のを避けるため
// ここで地方ごとにまとめ直す。中部は北陸・甲信越を含め、東海を独立させる
// （一般的な9地方区分。利用者が地理的に探しやすい粒度）。
export type RegionGroup = { key: string; nameJa: string; prefixes: string[] };

export const REGIONS: RegionGroup[] = [
  { key: "hokkaido", nameJa: "北海道", prefixes: ["01"] },
  { key: "tohoku", nameJa: "東北", prefixes: ["02", "03", "04", "05", "06", "07"] },
  { key: "kanto", nameJa: "関東", prefixes: ["08", "09", "10", "11", "12", "13", "14"] },
  { key: "chubu", nameJa: "中部・北陸", prefixes: ["15", "16", "17", "18", "19", "20"] },
  { key: "tokai", nameJa: "東海", prefixes: ["21", "22", "23", "24"] },
  { key: "kinki", nameJa: "近畿", prefixes: ["25", "26", "27", "28", "29", "30"] },
  { key: "chugoku", nameJa: "中国", prefixes: ["31", "32", "33", "34", "35"] },
  { key: "shikoku", nameJa: "四国", prefixes: ["36", "37", "38", "39"] },
  { key: "kyushu", nameJa: "九州・沖縄", prefixes: ["40", "41", "42", "43", "44", "45", "46", "47"] },
];

export type PrefsByRegion = { key: string; nameJa: string; prefs: PrefEntry[] };

/**
 * 与えた pref 配列（既定は PREFS 全件）を地方区分ごとにまとめ、地方は北→南、
 * 地方内は団体コード順に整列して返す。該当 pref が無い地方は省く（県別ページの
 * 「データのある県だけ」表示にも使えるよう、空グループは落とす）。
 */
export function prefsByRegion(prefs: PrefEntry[] = PREFS): PrefsByRegion[] {
  return REGIONS.map((r) => ({
    key: r.key,
    nameJa: r.nameJa,
    prefs: r.prefixes
      .map((px) => prefs.find((p) => p.codePrefix === px))
      .filter((p): p is PrefEntry => Boolean(p)),
  })).filter((g) => g.prefs.length > 0);
}

const BY_SLUG = new Map(PREFS.map((p) => [p.slug, p]));
const BY_PREFIX = new Map(PREFS.map((p) => [p.codePrefix, p]));

export function getPrefBySlug(slug: string): PrefEntry | null {
  return BY_SLUG.get(slug) ?? null;
}

/** 自治体コード（5桁）の先頭 2 桁から pref を引く */
export function getPrefByCode(code: string): PrefEntry | null {
  return BY_PREFIX.get(code.slice(0, 2)) ?? null;
}

export function listPrefSlugs(): string[] {
  return PREFS.map((p) => p.slug);
}
