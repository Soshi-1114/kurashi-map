"use client";

// 火災保険（一括見積もり）導線の表示専用コンポーネント。リンクの解決・表示可否は
// サーバー側（lib/monetization.kasaiHokenLink。env 未設定なら null＝導線ごと非表示）が
// 担い、ここは解決済みリンクの描画とクリック・視認計測だけを行う（FurusatoLink と同構成）。
//
// 現行案件は保険スクエアbang！火災保険。提携先を差し替える時は、名称・
// 無料表記・対象者も新しい案件の条件に合わせて更新する。
//
// 文言の制約（景表法ステマ規制 + ASP ガイドライン）:
// - 「お得」「還元」「安くなる」等の訴求をしない（比較・確認という中立文言に限定）
// - 広告であることを明示する（「広告」表記 + rel="sponsored"）
// - ハザード情報と隣接して置く文脈のため、不安を煽る表現はしない
import { ShieldCheck, ExternalLink } from "lucide-react";
import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics";
import { useImpressionOnce } from "@/lib/useImpression";
import type { KasaiLinkInfo } from "@/lib/monetization";
import { AdLinkRow } from "./AdLinkRow";

export function KasaiLink(props: Parameters<typeof KasaiLinkContent>[0]) {
  // 地図内で自治体が切り替わったら、新しい掲載として視認計測も開始する。
  return <KasaiLinkContent key={JSON.stringify([props.placement, props.municipalityCode, props.link.url])} {...props} />;
}

function KasaiLinkContent({
  link,
  municipalityCode,
  placement = "area",
}: {
  /** サーバー側で解決済みのリンク情報（kasaiHokenLink の非 null 戻り値） */
  link: KasaiLinkInfo;
  municipalityCode?: string;
  /** 掲載面。GA4 の click / impression を面ごとに分けて CTR を見るための次元 */
  placement?: "area" | "hazard-map" | "map-panel" | "shindan" | "pref-hazard";
}) {
  const eventParams = {
    measurement_version: "2026-10-24",
    cta_variant: "context-v1",
    placement,
    ...(municipalityCode ? { municipality_code: municipalityCode } : {}),
  };
  // 掲載と視認を分離し、広告までスクロールされているかを確認する。
  const rendered = useRef(false);
  useEffect(() => {
    if (rendered.current) return;
    rendered.current = true;
    track("kasai_link_render", {
      measurement_version: "2026-10-24",
      cta_variant: "context-v1",
      placement,
      ...(municipalityCode ? { municipality_code: municipalityCode } : {}),
    });
  }, [placement, municipalityCode]);
  // 視認計測（50% 到達で1回だけ）。クリックと合わせて掲載面ごとの視認ベースのCTRを見る分母。
  const impressionRef = useImpressionOnce<HTMLDivElement>("kasai_link_impression", eventParams);
  return (
    <div ref={impressionRef}>
      <AdLinkRow
        icon={<ShieldCheck size={18} aria-hidden="true" className="ad-linkrow-icon" />}
        copy="持ち家の火災保険を新しく検討する方へ"
        sub={<>補償内容や保険料を、見積もり・診断で確認できます。<br />広告・外部サイト「保険スクエアbang！」へ移動します</>}
        action={
          // rel: 広告リンクなので sponsored（+旧来の nofollow）。noreferrer は付けない
          // —— AT はリファラで掲載サイトを確認するため（FurusatoLink と同じ理由）。
          <a
            href={link.url}
            target="_blank"
            rel="sponsored nofollow noopener"
            referrerPolicy="no-referrer-when-downgrade"
            className="ad-linkrow-btn ad-linkrow-btn--solid"
            onClick={() => track("kasai_link_click", eventParams)}
          >
            無料で見積もり・診断を依頼
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
