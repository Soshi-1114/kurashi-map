// 家賃→色の5段階コロプレス。しきい値は固定（型と同じく契約面）。
// 配色は視認性とブランド性で随時更新可。
export const RENT_THRESHOLDS = [50000, 55000, 60000, 65000] as const;

// Tailwind blue 系の5段階。淡→濃でしっかり差が出る視認性重視。
export const RENT_COLORS = [
  "#dbeafe", // blue-100
  "#93c5fd", // blue-300
  "#60a5fa", // blue-400
  "#2563eb", // blue-600
  "#1e3a8a", // blue-900
] as const;

export function rentColor(value: number): string {
  if (value < RENT_THRESHOLDS[0]) return RENT_COLORS[0];
  if (value < RENT_THRESHOLDS[1]) return RENT_COLORS[1];
  if (value < RENT_THRESHOLDS[2]) return RENT_COLORS[2];
  if (value < RENT_THRESHOLDS[3]) return RENT_COLORS[3];
  return RENT_COLORS[4];
}

// MapLibre `step` 表現として家賃 → 色を返す。
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
