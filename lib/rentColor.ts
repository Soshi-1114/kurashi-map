// 家賃→色の5段階コロプレス。しきい値・配色は固定。
export const RENT_THRESHOLDS = [50000, 55000, 60000, 65000] as const;
export const RENT_COLORS = [
  "#dbe7f0",
  "#a7c4dc",
  "#6f9bc4",
  "#3f72a6",
  "#1f4d7a",
] as const;

export function rentColor(value: number): string {
  if (value < RENT_THRESHOLDS[0]) return RENT_COLORS[0];
  if (value < RENT_THRESHOLDS[1]) return RENT_COLORS[1];
  if (value < RENT_THRESHOLDS[2]) return RENT_COLORS[2];
  if (value < RENT_THRESHOLDS[3]) return RENT_COLORS[3];
  return RENT_COLORS[4];
}

// MapLibre `step` expression として家賃→色を返す。
// rent.value プロパティを参照することを前提とする。
export function rentStepExpression(): unknown {
  return [
    "step",
    ["get", "rent"],
    RENT_COLORS[0],
    RENT_THRESHOLDS[0], RENT_COLORS[1],
    RENT_THRESHOLDS[1], RENT_COLORS[2],
    RENT_THRESHOLDS[2], RENT_COLORS[3],
    RENT_THRESHOLDS[3], RENT_COLORS[4],
  ];
}
