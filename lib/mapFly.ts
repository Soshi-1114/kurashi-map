"use client";

// 地図へのフライト依頼の型。かつてはトップの埋め込み地図へ CustomEvent で依頼を送る
// ブリッジ（requestMapFly）を持っていたが、地図の /map 移設で送り手が消えたため型だけ残す
// （MapView 内の検索確定（MuniSearch → flyToMuni）と保留フライトが引き続き使う）。

import type { StationPoint } from "./stationSearch";

/** 地図へのフライト依頼。station 付きは自治体 bbox ではなく駅座標へ点フライト（マーカー付き）。 */
export type MapFlyDetail = {
  code: string;
  station?: StationPoint;
};
