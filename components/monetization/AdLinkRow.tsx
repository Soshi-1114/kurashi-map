// 生活関連導線（支援・ふるさと納税・電気代）の共通レイアウト。
// 行の骨格（アイコン + コピー + 右側アクション）だけを持ち、リンクの種別・
// 計測・文言は呼び出し側が担う。"use client" を付けないことで、server
// （DenkiTeaser）と client（SupportBanner / FurusatoLink）のどちらの文脈でも使える。
//
// 見た目は app/support-links.css の .ad-linkrow* 一式。ここで import しているので
// 掲載ページ側での CSS import は不要。導線を増やすときはこのコンポーネントを
// 使えば CSS の追加も不要（アイコン色などの差分だけ modifier クラスを足す）。
import "@/app/support-links.css";
import type { ReactNode } from "react";

export function AdLinkRow({
  icon,
  copy,
  sub,
  action,
}: {
  /** 左端のアイコン。className="ad-linkrow-icon"（+必要なら modifier）を付けて渡す */
  icon: ReactNode;
  copy: ReactNode;
  sub?: ReactNode;
  /** 右側のアクション。className="ad-linkrow-btn"（塗りは +"ad-linkrow-btn--solid"）を付けて渡す */
  action: ReactNode;
}) {
  return (
    <div className="ad-linkrow">
      <div className="ad-linkrow-text">
        {icon}
        <p className="ad-linkrow-copy">
          {copy}
          {sub != null && <span className="ad-linkrow-sub">{sub}</span>}
        </p>
      </div>
      {action}
    </div>
  );
}
