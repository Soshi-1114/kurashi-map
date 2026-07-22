"use client";

// 投げ銭・サポーター導線（控えめ）。Wikipedia の寄付バナー程度のトーンで、
// データ可視化エリアとは視覚的に分離した位置に置く。支援先URLは環境変数で管理。
import { Heart } from "lucide-react";
import { track } from "@/lib/analytics";

export function SupportBanner({
  url,
  municipalityCode,
  municipalityName,
}: {
  /** 支援先URL（NEXT_PUBLIC_SUPPORT_URL）。null なら呼び出し側で非表示にする。 */
  url: string;
  municipalityCode: string;
  municipalityName: string;
}) {
  return (
    <div className="ad-support">
      <div className="ad-support-text">
        <Heart size={18} aria-hidden="true" className="ad-support-icon" />
        <p className="ad-support-copy">
          このデータが役に立ったら
          <span className="ad-support-sub">KurashiMap は無料で運営しています。任意のご支援が更新の励みになります。</span>
        </p>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="ad-support-btn"
        onClick={() =>
          track("support_link_click", {
            municipality_code: municipalityCode,
            municipality_name: municipalityName,
          })
        }
      >
        支援する
      </a>
    </div>
  );
}
