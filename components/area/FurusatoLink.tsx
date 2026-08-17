"use client";

// ふるさと納税導線（自治体別）。そのページが扱う自治体専用の検索リンクを生成する。
// URL 生成は lib/monetization.generateFurusatoUrl に一元化（提携先ASP変更に1箇所で追従）。
//
// 2025年10月以降、ふるさと納税でのポイント還元は禁止のため、還元・ポイント訴求はしない。
import { Gift, ExternalLink } from "lucide-react";
import { track } from "@/lib/analytics";
import { generateFurusatoUrl } from "@/lib/monetization";
import { AdLinkRow } from "./AdLinkRow";

export function FurusatoLink({
  targetName,
  prefName,
  municipalityCode,
}: {
  /** 寄付先自治体名（行政区の場合は親の政令市名） */
  targetName: string;
  prefName: string;
  municipalityCode: string;
}) {
  const url = generateFurusatoUrl(targetName, prefName);
  return (
    <AdLinkRow
      icon={<Gift size={18} aria-hidden="true" className="ad-linkrow-icon" />}
      copy={`${targetName}のふるさと納税を見る`}
      sub="※外部サイト（ふるさと納税ポータル）へ移動します"
      action={
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="ad-linkrow-btn ad-linkrow-btn--solid"
          onClick={() =>
            track("furusato_link_click", {
              municipality_code: municipalityCode,
              municipality_name: targetName,
            })
          }
        >
          ふるさと納税を見る
          <ExternalLink size={15} aria-hidden="true" />
        </a>
      }
    />
  );
}
