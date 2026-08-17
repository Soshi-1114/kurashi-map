"use client";

// トップページの2つの独立したクライアント島（ヒーロー検索と地図）を疎結合につなぐ
// 最小限のブリッジ。ヒーロー検索の「地図で表示」ボタンが CustomEvent を投げ、
// MapView 側がマウント中だけ listen して既存の flyToMuni を呼ぶ。
// 状態管理ライブラリや context の持ち回りを避けるための window イベント1本のみ。

export const MAP_FLY_EVENT = "kurashimap:flyto";

export type MapFlyDetail = {
  code: string;
  /** 駅検索由来のとき、自治体 bbox ではなく駅座標へ点フライトする（マーカー付き） */
  station?: { name: string; lng: number; lat: number };
};

/** ページ内の地図へ「この自治体（または駅）へフライトして」と依頼する（地図未マウント時は無視される）。 */
export function requestMapFly(code: string, station?: MapFlyDetail["station"]): void {
  window.dispatchEvent(new CustomEvent<MapFlyDetail>(MAP_FLY_EVENT, { detail: { code, station } }));
}
