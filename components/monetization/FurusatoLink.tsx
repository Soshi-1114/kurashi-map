"use client";

// ふるさと納税導線の表示専用コンポーネント。リンクの解決・表示可否は
// サーバー側（lib/monetization.furusatoLink + lib/furunaviMunicipals）が担い、
// ここは解決済みの FurusatoLinkInfo を受け取って描画とクリック・表示計測だけを行う
// （約1,600件のID対応表やリンク生成ロジックをクライアントに配らない）。
// 自治体詳細ページ（targetName あり）とランキング等の共通面（targetName なし・portal）の両方で使う。
//
// 文言の制約（アクセストレード×ふるなびガイドライン + 景表法ステマ規制）:
// - 返礼品の紹介・強調をしない（特定自治体を対象とした返礼品誘引広告は成果却下）
// - 「お得」「還元」「セール」等の訴求をしない（2025年10月以降ポイント還元も制度上禁止）
// - 広告であることを明示する（「広告」表記 + rel="sponsored"）
import { useEffect, useRef } from "react";
import { Gift, ExternalLink } from "lucide-react";
import { track } from "@/lib/analytics";
import { useImpressionOnce } from "@/lib/useImpression";
import type { FurusatoLinkInfo } from "@/lib/monetization";
import { AdLinkRow } from "./AdLinkRow";

export function FurusatoLink(props: Parameters<typeof FurusatoLinkContent>[0]) {
  return <FurusatoLinkContent key={JSON.stringify([props.placement, props.municipalityCode, props.targetName, props.link.kind, props.link.url])} {...props} />;
}

function FurusatoLinkContent({
  link,
  targetName,
  municipalityCode,
  placement = "area",
}: {
  /** サーバー側で解決済みのリンク情報（furusatoLink の非 null 戻り値） */
  link: FurusatoLinkInfo;
  /** 寄付先自治体名（行政区の場合は親の政令市名）。自治体に紐付かない面では省略 */
  targetName?: string;
  municipalityCode?: string;
  /** 掲載面。GA4 の click / impression を面ごとに分けて CTR を見るための次元 */
  placement?: "area" | "ranking" | "ranking-top" | "future-view";
}) {
  // portal（固定リンク）は着地がポータルのトップ等になるため、
  // 自治体のページに着くと誤解させない文言にする。
  const isPortal = link.kind === "portal";
  const copy = !isPortal && targetName
    ? `ふるさと納税で${targetName}を応援する`
    : "寄付先を選んで、ふるさと納税で地域を応援";
  const sub = isPortal
    ? "広告・ふるなびトップへ移動します。寄付先の自治体は移動先で選べます。"
    : "この地域への寄付を検討している方へ。広告・ふるなびの自治体ページに移動します。";
  const actionLabel = isPortal
    ? "ふるなびで寄付先を探す"
    : targetName ? `ふるなびで${targetName}を見る` : "ふるなびの自治体ページを見る";
  const eventParams = {
    measurement_version: "2026-10-24",
    cta_variant: "donation-v1",
    kind: link.kind,
    placement,
    ...(municipalityCode ? { municipality_code: municipalityCode } : {}),
    ...(targetName ? { municipality_name: targetName } : {}),
  };
  const initialParams = useRef(eventParams);
  const rendered = useRef(false);
  useEffect(() => {
    if (rendered.current) return;
    rendered.current = true;
    track("furusato_link_render", initialParams.current);
  }, []);
  // 視認計測（50% 到達で1回だけ）。クリックと合わせて面ごとの視認ベースのCTRを見る分母。
  const impressionRef = useImpressionOnce<HTMLDivElement>("furusato_link_impression", eventParams);
  return (
    <div ref={impressionRef}>
      <AdLinkRow
        icon={<Gift size={18} aria-hidden="true" className="ad-linkrow-icon" />}
        copy={copy}
        sub={sub}
        action={
          // rel: 広告リンクなので sponsored（+旧来の nofollow）。noreferrer は付けない
          // —— AT の生成コードは referrerpolicy で参照元を送る指定で、掲載サイトの
          // 確認（ガイドラインの開示義務）にリファラが使われるため。
          <a
            href={link.url}
            target="_blank"
            rel="sponsored nofollow noopener"
            referrerPolicy="no-referrer-when-downgrade"
            className="ad-linkrow-btn ad-linkrow-btn--solid"
            onClick={() => track("furusato_link_click", eventParams)}
          >
            {actionLabel}
            <ExternalLink size={15} aria-hidden="true" />
            {/* AT のインプレッション計測ピクセル（生成リンクコードと同じ対で描画） */}
            {link.impressionPixel && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={link.impressionPixel} width={1} height={1} alt="" aria-hidden="true" />
            )}
          </a>
        }
      />
    </div>
  );
}
