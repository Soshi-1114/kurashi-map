import { parseCsvLine } from "./csv.mjs";

export function parseAreaCsv(buffer, asOf) {
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(buffer); }
  catch { text = new TextDecoder("shift_jis", { fatal: true }).decode(buffer); }
  const rows = text.replace(/^\uFEFF/, "").split(/\r?\n/).map(parseCsvLine);
  const header = rows.find((r) => r[0] === "標準地域コード");
  const [year, month, day] = asOf.split("-").map(Number);
  const label = `令和${year - 2018}年${month}月${day}日`;
  if (!header?.[4]?.startsWith(label)) throw new Error("面積CSVの最新列とMENCHO_ASOFが一致しません");
  const values = new Map();
  for (const row of rows) {
    if (!/^\d{4,5}$/.test(row[0] ?? "")) continue;
    const code = row[0].padStart(5, "0");
    const value = Number(row[4]);
    if (!Number.isFinite(value) || value <= 0) continue;
    if (values.has(code)) throw new Error(`面積CSVの地域コードが重複しています: ${code}`);
    values.set(code, value);
  }
  return values;
}
