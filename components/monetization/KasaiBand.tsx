// 特定自治体に紐付かない面（/map/hazard 等）に置く火災保険導線の帯。
// env（NEXT_PUBLIC_KASAI_HOKEN_URL）未設定なら何も描画しない。掲載ページは
// <KasaiBand placement="..." /> を置くだけ（FurusatoBand と同構成の server component）。
import { kasaiHokenLink } from "@/lib/monetization";
import { KasaiLink } from "./KasaiLink";

export function KasaiBand({ placement }: { placement: "area" | "hazard-map" }) {
  const link = kasaiHokenLink();
  if (!link) return null;
  return (
    <section className="ad-support-section" aria-label="生活関連の参考リンク">
      <KasaiLink link={link} placement={placement} />
    </section>
  );
}
