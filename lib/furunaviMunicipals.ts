// ふるなび掲載自治体の JISコード → ふるなび内部ID（municipalid）対応表へのアクセス。
// データは scripts/fetch-furunavi-municipals.mjs が生成する（掲載自治体の増減に
// 合わせて年1回程度再実行）。政令市の区は対応表に載せていないので、呼び出し側で
// 親の政令市コードを渡すこと。
//
// サーバー専用の想定（約1,600件の対応表をクライアントに配らない）。ふるさと納税
// 導線の表示可否＝「ふるなびに掲載があるか」の判定もこの対応表が担う。
import data from "../data/furunavi-municipals.json";

const byCode: Record<string, number> = data.byCode;

/** ふるなびの自治体ID。未掲載の自治体は null（導線を表示しない）。 */
export function furunaviMunicipalId(code: string): number | null {
  return byCode[code] ?? null;
}

// リンク先に付ける utm。ふるなびが AT 向け既定リンクに付けているもので、
// AT 商品リンク一括作成の生成結果と同一のリンク先になるよう合わせる（2026-08 確認）。
const AT_UTM = "utm_source=at&utm_medium=affiliate&utm_campaign=default";

/** ふるなびの自治体ページ（寄付先ページ）URL。未掲載の自治体は null。 */
export function furunaviMunicipalPageUrl(code: string): string | null {
  const id = furunaviMunicipalId(code);
  if (id == null) return null;
  return `https://furunavi.jp/Municipal/Product/Search?municipalid=${id}&${AT_UTM}`;
}

/**
 * ふるなびトップページ URL（特定自治体に紐付かない面＝ランキング等の導線用。
 * 寄付先は移動先で選ぶ）。
 */
export const FURUNAVI_TOP_PAGE_URL = `https://furunavi.jp/?${AT_UTM}`;
