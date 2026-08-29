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
 * ASP のリンク先URL自由型リンク（アクセストレードの商品リンク等）を設定する。
 * `{url}` プレースホルダをリンク先URL（URLエンコード済み）で置換する。
 * 例: https://h.accesstrade.net/sp/cc?rk=xxxx&url={url}
 */
export function furusatoUrlTemplate(): string | null {
  const t = process.env.NEXT_PUBLIC_FURUSATO_URL_TEMPLATE?.trim();
  return t && t.includes("{url}") ? t : null;
}

/**
 * ASP発行の固定アフィリエイトリンク（例: アクセストレードのテキストリンク）。
 * 商品リンク（テンプレート）が使えなくなった場合の運用フォールバック。未設定なら null。
 */
export function furusatoAffUrl(): string | null {
  const u = process.env.NEXT_PUBLIC_FURUSATO_AFF_URL?.trim();
  return u ? u : null;
}

export type FurusatoLinkInfo = {
  url: string;
  /** municipal = 自治体ページへのディープリンク / portal = ポータルの固定ページへ（寄付先は移動先で選ぶ） */
  kind: "municipal" | "portal";
  /** AT のインプレッション計測ピクセル（sp/rr）。クリックリンクと対で描画する。AT 以外は null */
  impressionPixel: string | null;
};

// アクセストレードの生成リンクコードはクリック URL（sp/cc）と対で 1x1 の計測画像
// （sp/rr）を持つ。リンクだけ張ると imp が計上されないため、対の URL をここで導出する。
function atImpressionPixel(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname !== "h.accesstrade.net") return null;
    const rk = u.searchParams.get("rk");
    return rk ? `https://h.accesstrade.net/sp/rr?rk=${rk}` : null;
  } catch {
    return null;
  }
}

/**
 * ふるさと納税導線のリンクを返す。null なら導線は表示しない。
 *
 * 非表示になるのは (a) env 未設定、(b) リンク先がない＝ふるなび未掲載の自治体
 * （destUrl が null）。未掲載自治体に導線を出すと、移動先で寄付先が見つからない
 * 誤誘導になるため出さない。
 *
 * テンプレート（自治体ページへのディープリンク）＞ 固定リンクの順で採用。
 * env に設定されるのは ASP 発行のリンクなので、denkiOfferUrl と同じ契約で
 * 一切加工せずそのまま使う（UTM を足すと ASP 計測を壊す）。
 *
 * @param destUrl リンク先URL（lib/furunaviMunicipals.ts の furunaviMunicipalPageUrl /
 *   FURUNAVI_TOP_PAGE_URL で解決。未掲載は null）
 * @param destKind destUrl の着地の種類。自治体ページなら "municipal"（既定）、
 *   ふるなびトップ等なら "portal"。固定リンクへのフォールバック時は着地が
 *   ポータル側になるため destKind に関わらず "portal" を返す
 */
export function furusatoLink(
  destUrl: string | null,
  destKind: "municipal" | "portal" = "municipal",
): FurusatoLinkInfo | null {
  if (destUrl == null) return null;
  const template = furusatoUrlTemplate();
  if (template) {
    const url = template.replaceAll("{url}", encodeURIComponent(destUrl));
    return { url, kind: destKind, impressionPixel: atImpressionPixel(url) };
  }
  const aff = furusatoAffUrl();
  if (aff) return { url: aff, kind: "portal", impressionPixel: atImpressionPixel(aff) };
  return null;
}
