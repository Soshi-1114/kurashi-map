// 全指標共通の値の型。APIに差し替えてもこの型は変えない。
export type Metric = {
  value: number;
  unit: string;          // "円/月", "円/㎡", "人" など
  source: string;        // 出典表記
  asOf: string;          // 基準時点 "2023" など
  isEstimated: boolean;  // 推計値フラグ（欠落町村の補完等）
};

export type HazardInfo = {
  hasFloodRisk: boolean;
  hasLandslideRisk: boolean;
  note: string;          // "荒川沿いに浸水想定" など
  source: string;
  asOf: string;
};

export type Municipality = {
  code: string;          // 全国地方公共団体コード 例 "11203"
  pref: string;          // "saitama"（URL用スラッグ）
  name: string;          // "川口市"
  population: number;
  populationTrend: "増加" | "微増" | "横ばい" | "微減" | "減少";
  rent: Metric;          // 民営借家中央値
  landPrice: Metric;     // 住宅地地価
  waitlistChildren: Metric; // 待機児童（value=人数）
  hazard: HazardInfo;
};
