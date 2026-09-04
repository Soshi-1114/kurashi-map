"use client";
// 要素がビューポートに入ったことを GA4 に1回だけ送るためのフック。
//
// 広告・送客導線の「視認」計測に使う（クリック÷表示で真の CTR を出す分母）。
// AT のインプレッションピクセル（sp/rr）は DOM 描画時に発火し視認を意味しない
// ため、ビューポート到達の計測はこちらが正。honesty 方針に合わせて閾値 50% の
// 実際の到達だけを送り、発火は要素ごとに1回に限る。
import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics";

/**
 * 返り値の ref を付けた要素が 50% 以上表示されたら eventName を1回だけ送る。
 * IntersectionObserver がない環境（jsdom・古いブラウザ）では何もしない。
 * params は初回マウント時点の値を使う（送信は1回なので再購読しない）。
 */
export function useImpressionOnce<T extends HTMLElement>(
  eventName: string,
  params: Record<string, unknown>,
): React.RefObject<T | null> {
  const ref = useRef<T>(null);
  // 送信は1回きりなので、params は初回マウント時点の値を捕捉すれば足りる
  const paramsRef = useRef(params);
  const sent = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || sent.current || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (sent.current || !entries.some((e) => e.isIntersecting)) return;
        sent.current = true;
        track(eventName, paramsRef.current);
        io.disconnect();
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [eventName]);

  return ref;
}
