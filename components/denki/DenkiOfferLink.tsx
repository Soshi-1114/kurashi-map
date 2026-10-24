"use client";
import { ExternalLink } from "lucide-react";
import { DENKI_OFFER_CTA_PARAMS, trackDenkiOfferClick } from "@/lib/analytics";
import { useImpressionOnce } from "@/lib/useImpression";
import type { denkiOfferUrl } from "@/lib/monetization";

export default function DenkiOfferLink({ link, company, planName, offerId, area, position }: {
  link: ReturnType<typeof denkiOfferUrl>;
  company: string;
  planName: string;
  offerId: string;
  area: string;
  position: number;
}) {
  const params = { offer_id: offerId, area, is_affiliate: link.isAffiliate, position, ...DENKI_OFFER_CTA_PARAMS };
  const ref = useImpressionOnce<HTMLDivElement>("denki_offer_view", params);
  return <div ref={ref} className="dnk-offer-action">
    <a className="dnk-link" href={link.url} target="_blank"
      rel={link.isAffiliate ? "sponsored nofollow noopener" : "noopener noreferrer"}
      referrerPolicy={link.isAffiliate ? "no-referrer-when-downgrade" : undefined}
      aria-label={`${company} ${planName}の料金・条件を確認する`}
      onClick={() => trackDenkiOfferClick({ offerId, area, isAffiliate: link.isAffiliate, position })}>
      料金・条件を確認する<ExternalLink size={15} aria-hidden="true" />
      {link.impressionPixel && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={link.impressionPixel} width={1} height={1} alt="" aria-hidden="true" />
      )}
    </a>
    <p className="dnk-link-note">{link.isAffiliate ? "広告・" : ""}{company}の外部サイトへ移動します。最新の料金・供給エリア・適用条件をご確認ください。</p>
  </div>;
}
