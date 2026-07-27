// マネタイズ導線のURL生成・設定を一元化するモジュール。
//
// 方針: サイトの中立性・信頼性を崩さない範囲での「支援導線」と「文脈一致のふるさと納税導線」に限定する。
// リンク先URL・提携先ASPは未確定・将来変更されうるため、すべて環境変数＋関数化して
// 1箇所の変更で差し替えられるようにする（実URL・アフィリエイトIDはここに直書きしない）。
//
// 注: NEXT_PUBLIC_* はクライアントにも露出する公開値のみ。API キー等の秘密情報は載せない。

/** 送客時に付与する UTM（既存の外部送客と整合させる）。 */
const UTM = {
  source: "kurashimap",
  medium: "referral",
} as const;

/** 投げ銭・サポーターの支援先 URL。未設定なら支援導線は表示しない。 */
export function supportUrl(): string | null {
  const u = process.env.NEXT_PUBLIC_SUPPORT_URL?.trim();
  return u ? u : null;
}

/**
 * ふるさと納税リンクの URL テンプレート。未設定・不正なら null（導線は表示しない）。
 *
 * 提携先ASP（さとふる／ふるなび等）の審査完了までは env を空にして導線ごと非表示にする
 * （さとふる検索URLへの素リンクは 404 になるため。2026-07 確認）。
 */
export function furusatoUrlTemplate(): string | null {
  const t = process.env.NEXT_PUBLIC_FURUSATO_URL_TEMPLATE?.trim();
  return t && t.includes("{keyword}") ? t : null;
}

/**
 * ふるさと納税の検索リンク生成。
 *
 * 環境変数 NEXT_PUBLIC_FURUSATO_URL_TEMPLATE の `{keyword}` を自治体名で置換する。
 * 表示の可否は呼び出し側が furusatoUrlTemplate() で判定する前提（未設定時の
 * さとふる検索URLフォールバックは後方互換のために残している）。
 *
 * @param cityName 寄付先自治体名（政令市の行政区の場合は親の政令市名を渡すこと）
 * @param prefName 都道府県名（同名自治体の曖昧さ回避のため keyword に前置する）
 */
export function generateFurusatoUrl(cityName: string, prefName?: string): string {
  // 「府中市」など同名自治体があるため、県名を前置して一意性を上げる。
  const keyword = prefName ? `${prefName}${cityName}` : cityName;
  const encoded = encodeURIComponent(keyword);

  const template = furusatoUrlTemplate();
  let base: string;
  if (template) {
    base = template.replaceAll("{keyword}", encoded);
  } else {
    // デフォルト: さとふるのキーワード検索（提携確定まではアフィリエイトIDなしの素のURL）。
    base = `https://www.satofull.jp/search/?keyword=${encoded}`;
  }

  // UTM を付与（テンプレートに ? が含まれるかで結合子を選ぶ）。
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}utm_source=${UTM.source}&utm_medium=${UTM.medium}&utm_campaign=furusato`;
}
