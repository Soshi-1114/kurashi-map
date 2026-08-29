"use client";

// ページ共有ボタン。Web Share API があれば OS の共有シートを開き、
// なければ URL をクリップボードへコピーして一時的に完了表示を出す。
// OG 画像・canonical・URL 状態管理は各ページが既に持っているため、
// このボタンは共有の起点（導線）だけを足す。計測は GA4 推奨の share イベント。
import { useEffect, useRef, useState } from "react";
import { Check, Share2 } from "lucide-react";
import { trackShare } from "@/lib/analytics";

export function ShareButton({
  title,
  path,
  contentType,
  itemId,
  className,
  label = "共有する",
}: {
  /** 共有シートに渡すタイトル */
  title: string;
  /** 共有するパス。省略時は現在のURL（?codes= のような状態付きURLを共有したいページで省略する） */
  path?: string;
  /** GA4 share イベントの content_type（例: area / ranking / compare） */
  contentType: string;
  /** GA4 share イベントの item_id（自治体コードやランキング slug） */
  itemId: string;
  className?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const onClick = async () => {
    const url = path ? new URL(path, window.location.origin).toString() : window.location.href;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
      } catch {
        // ユーザーのキャンセル（AbortError）等。共有は起きていないので計測しない
        return;
      }
      trackShare({ method: "web_share", contentType, itemId });
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // クリップボード拒否時は完了表示を出さない（起きていないことを見せない）
      return;
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
    trackShare({ method: "copy", contentType, itemId });
  };

  return (
    <button type="button" onClick={onClick} className={className} aria-live="polite">
      {copied ? <Check size={15} aria-hidden="true" /> : <Share2 size={15} aria-hidden="true" />}
      {copied ? "リンクをコピーしました" : label}
    </button>
  );
}
