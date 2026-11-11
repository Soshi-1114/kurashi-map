// 基本集計の単一表章・単一年・男女総数のみを読む。欠測を0にしない。
export function censusValues(sd, { tab, unit }) {
  if (!sd?.DATA_INF?.VALUE) throw new Error("国勢調査の値がありません");
  const values = Array.isArray(sd.DATA_INF.VALUE) ? sd.DATA_INF.VALUE : [sd.DATA_INF.VALUE];
  const result = new Map();
  for (const row of values) {
    if (row["@tab"] !== tab || row["@time"] !== "2025000000" || row["@unit"] !== unit ||
      (row["@cat01"] !== undefined && row["@cat01"] !== "0")) {
      throw new Error("国勢調査の表章・年次・単位・男女区分が想定と異なります");
    }
    const code = row["@area"];
    // 旧境界行の英字入りコードは現行の5桁自治体コードと区別する。
    if (!/^\d{5}$/.test(code ?? "")) continue;
    if (result.has(code)) throw new Error(`国勢調査の地域コードが重複しています: ${code}`);
    const raw = String(row["$"] ?? "").trim();
    if (["-", "***", "…"].includes(raw)) { result.set(code, null); continue; }
    if (!/^-?\d+(\.\d+)?$/.test(raw)) throw new Error("国勢調査に解釈できない値があります");
    const value = Number(raw);
    if (!Number.isFinite(value) || (unit === "人" && (!Number.isInteger(value) || value < 0))) {
      throw new Error("国勢調査の数値が不正です");
    }
    result.set(code, value);
  }
  return result;
}

export function populationTrend(ratePct) {
  if (!Number.isFinite(ratePct)) throw new Error("人口増減率が数値ではありません");
  if (ratePct >= 3) return "増加";
  if (ratePct >= 1) return "微増";
  if (ratePct > -1) return "横ばい";
  if (ratePct > -3) return "微減";
  return "減少";
}
