// 特定自治体に紐付かない面（ランキング等）に置くふるさと納税導線の帯。
// リンク解決からセクションの描画までを自己完結で担い、env（商品リンクテンプレート
// or 固定リンク）未設定なら何も描画しない。掲載ページは <FurusatoBand /> を置くだけ
// （CSS は AdLinkRow が import 済み）。ランキング以外の面に載せるときは placement を
// prop 化して GA4 の計測面を分ける。
// server component（リンク解決を server に留め、ID対応表をクライアントに配らない）。
import { furusatoLink } from "@/lib/monetization";
import { FURUNAVI_TOP_PAGE_URL } from "@/lib/furunaviMunicipals";
import { FurusatoLink } from "./FurusatoLink";

export function FurusatoBand() {
  // ふるなびトップへのディープリンク。着地は自治体ページではないため portal（中立文言）
  const link = furusatoLink(FURUNAVI_TOP_PAGE_URL, "portal");
  if (!link) return null;
  return (
    <section className="ad-support-section" aria-label="生活関連の参考リンク">
      <FurusatoLink link={link} placement="ranking" />
    </section>
  );
}
