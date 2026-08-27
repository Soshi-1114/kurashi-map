"use client";

// ふるさと納税導線（自治体別）。リンク生成・表示可否は lib/monetization.furusatoLink に
// 一元化（提携先ASP・リンク形式の変更に1箇所で追従）。ふるなび未掲載の自治体では
// 何も描画しない（furunaviId=null → furusatoLink が null を返す）。
//
// 文言の制約（アクセストレード×ふるなびガイドライン + 景表法ステマ規制）:
// - 返礼品の紹介・強調をしない（特定自治体を対象とした返礼品誘引広告は成果却下）
// - 「お得」「還元」「セール」等の訴求をしない（2025年10月以降ポイント還元も制度上禁止）
// - 広告であることを明示する（「広告」表記 + rel="sponsored"）
import { Gift, ExternalLink } from "lucide-react";
import { track } from "@/lib/analytics";
import { furusatoLink } from "@/lib/monetization";
import { AdLinkRow } from "./AdLinkRow";

export function FurusatoLink({
  targetName,
  prefName,
  municipalityCode,
  furunaviId,
}: {
  /** 寄付先自治体名（行政区の場合は親の政令市名） */
  targetName: string;
  prefName: string;
  municipalityCode: string;
  /** ふるなびの自治体ID（サーバー側で lib/furunaviMunicipals から引いて渡す。未掲載は null） */
  furunaviId: number | null;
}) {
  const link = furusatoLink(targetName, prefName, furunaviId);
  if (!link) return null;
  // portal（固定リンク）は着地がポータルのトップ等になるため、
  // 自治体のページに着くと誤解させない文言にする。
  const copy =
    link.kind === "portal"
      ? `ふるさと納税で${targetName}を応援する`
      : `${targetName}のふるさと納税を見る`;
  const sub =
    link.kind === "portal"
      ? "※広告・外部サイト「ふるなび」へ移動します。寄付先は移動先で選択できます"
      : "※広告・外部サイト「ふるなび」へ移動します";
  return (
    <AdLinkRow
      icon={<Gift size={18} aria-hidden="true" className="ad-linkrow-icon" />}
      copy={copy}
      sub={sub}
      action={
        <a
          href={link.url}
          target="_blank"
          rel="sponsored noopener noreferrer"
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
