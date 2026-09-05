"use client";

// 道具のページ（比較・診断）への着地を1回だけ計測するフック。
//
// 送り出す側ではなく着地側で数えるのは意図的:
// 順位表の各行をクライアントコンポーネントにすると100件ぶん hydration が増えるうえ、
// 着地を数えるほうがプリフェッチ・中クリック・戻るにも強い。リンクは素の
// サーバーコンポーネントのままにできる（URL は lib/siteNav の compareHref / shindanHref）。
//
// 比較と診断で別々に手書きしていたものをここに集約した（同じ概念に2つの実装があると
// 3つ目の道具で3つ目の実装が生まれる）。

import { useEffect, useRef } from "react";
import { trackToolEntry } from "./analytics";

/**
 * `?from=` があれば `tool_entry` を1回だけ送る。
 *
 * @param tool 着地した道具
 * @param detail 面ごとの追加パラメータ（比較の municipality_codes / count など）。
 *   「着地した瞬間」を1回数えるだけなので、初回マウント時点の値を使う。
 */
export function useToolEntry(tool: "compare" | "shindan", detail?: Record<string, unknown>): void {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    const from = new URLSearchParams(window.location.search).get("from");
    if (!from) return;
    fired.current = true;
    trackToolEntry(tool, from, detail);
    // detail は初回マウント時点の値でよい（着地を1回数えるだけで、以後の変化は追わない）。
    // 依存に入れると比較で選択を変えるたびに effect が走り、ガードの意図がぼやける。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);
}
