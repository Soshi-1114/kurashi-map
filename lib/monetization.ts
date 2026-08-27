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

/** 送客導線の一覧（campaign 名の単一の正典。導線を増やす時はここに足す）。 */
type UtmCampaign = "furusato" | "denki";

/** base URL に UTM を付与する（`?` の有無で結合子を選ぶ）。 */
function withUtm(base: string, campaign: UtmCampaign): string {
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}utm_source=${UTM.source}&utm_medium=${UTM.medium}&utm_campaign=${campaign}`;
}

/** 投げ銭・サポーターの支援先 URL。未設定なら支援導線は表示しない。 */
export function supportUrl(): string | null {
  const u = process.env.NEXT_PUBLIC_SUPPORT_URL?.trim();
  return u ? u : null;
}

/**
 * 電気プラン（/denki）のアフィリエイトリンク設定。
 *
 * NEXT_PUBLIC_* はビルド時の静的置換なので process.env[動的キー] は使えない。
 * 提携する会社を増やすときは data/denki-plans.json に offer を足すのと併せて
 * ここに 1 行追加する（どのみち JSON 編集＝デプロイが必要なので追加摩擦はない）。
 */
function denkiAffLinks(): Record<string, string | undefined> {
  return {
    // 例: "looop-denki": process.env.NEXT_PUBLIC_DENKI_AFF_LOOOP,
  };
}

/**
 * 電気プランの外部リンク URL を返す。
 * - env にアフィリエイトリンクがあればそれを使う（ASP 計測を壊さないよう UTM は付けない）
 * - なければ公式サイトへの素リンク + UTM（導線を非表示にせず、ツールとしての有用性を保つ）
 *
 * @param links テスト用の注入口（既定は env 由来の denkiAffLinks()）
 */
export function denkiOfferUrl(
  offerId: string,
  officialUrl: string,
  links: Record<string, string | undefined> = denkiAffLinks(),
): { url: string; isAffiliate: boolean } {
  const aff = links[offerId]?.trim();
  if (aff) return { url: aff, isAffiliate: true };
  return { url: withUtm(officialUrl, "denki"), isAffiliate: false };
}

/**
 * ふるさと納税リンクの URL テンプレート。未設定・不正なら null。
 *
 * `{keyword}` を自治体名（県名前置）で置換する検索ディープリンク用。ASP が
 * リンク先URL自由型のリンク（商品リンク等）を許可している場合に設定する。
 */
export function furusatoUrlTemplate(): string | null {
  const t = process.env.NEXT_PUBLIC_FURUSATO_URL_TEMPLATE?.trim();
  return t && t.includes("{keyword}") ? t : null;
}

/**
 * ASP発行の固定アフィリエイトリンク（例: アクセストレードのテキストリンク）。
 * キーワード差し込みができない標準リンク用。未設定なら null。
 */
export function furusatoAffUrl(): string | null {
  const u = process.env.NEXT_PUBLIC_FURUSATO_AFF_URL?.trim();
  return u ? u : null;
}

/** ふるさと納税導線を表示するか。テンプレート・固定リンクのどちらかの env 設定で点灯。 */
export function hasFurusatoLink(): boolean {
  return furusatoUrlTemplate() != null || furusatoAffUrl() != null;
}

// ASP のリダイレクトドメイン。UTM を付けると計測を壊しうるため付与しない判定に使う
// （denkiOfferUrl と同方針）。提携 ASP を増やす時はここに足す。
const ASP_HOSTS = ["accesstrade.net", "a8.net", "valuecommerce.com"];
function isAspLink(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return ASP_HOSTS.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

export type FurusatoLinkInfo = {
  url: string;
  /** search = 自治体名で絞った検索結果へ / portal = ポータルの固定ページへ（寄付先は移動先で選ぶ） */
  kind: "search" | "portal";
};

/**
 * ふるさと納税導線のリンクを返す。env 未設定なら null（導線は表示しない）。
 *
 * テンプレート（自治体で絞った結果に着地でき成果に繋がりやすい）＞ 固定リンクの順で採用。
 *
 * @param cityName 寄付先自治体名（政令市の行政区の場合は親の政令市名を渡すこと）
 * @param prefName 都道府県名（「府中市」など同名自治体の曖昧さ回避のため keyword に前置する）
 */
export function furusatoLink(cityName: string, prefName?: string): FurusatoLinkInfo | null {
  const template = furusatoUrlTemplate();
  if (template) {
    const keyword = encodeURIComponent(prefName ? `${prefName}${cityName}` : cityName);
    const base = template.replaceAll("{keyword}", keyword);
    return { url: isAspLink(base) ? base : withUtm(base, "furusato"), kind: "search" };
  }
  const aff = furusatoAffUrl();
  if (aff) return { url: aff, kind: "portal" };
  return null;
}
