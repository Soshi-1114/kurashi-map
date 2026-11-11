import { parseCsvLine } from "./csv.mjs";

export function parseMedicalCsv(buffer, kind, asOf) {
  const text = new TextDecoder("shift_jis", { fatal: true }).decode(buffer).normalize("NFKC");
  const rows = text.split(/\r?\n/).map(parseCsvLine);
  const year = asOf.match(/^(\d{4})年10月$/)?.[1];
  if (!year || !rows[0].join("").includes(`${year})年10月1日`) ||
      !rows[1]?.join("").includes(kind === "hospital" ? "第1表" : "第2表")) {
    throw new Error("医療CSVの表番号・基準日が設定と一致しません");
  }
  if (kind === "clinic" && (!rows[2]?.[1]?.includes("一般診療所数") || !rows[2]?.[5]?.includes("歯科診療所数"))) {
    throw new Error("医療CSVの診療所列が想定と異なります");
  }
  const values = new Map();
  for (const row of rows) {
    const code = row[0]?.match(/^(\d{5})\s/)?.[1];
    if (!code) continue; // 都道府県・二次医療圏の集計行を除く
    const count = (raw) => {
      const s = String(raw ?? "").trim();
      if (s === "-") return 0; // 当該施設なし
      if (!/^\d+$/.test(s)) throw new Error(`医療CSVの施設数が不明です: ${code}`);
      return Number(s);
    };
    if (values.has(code)) throw new Error(`医療CSVの地域コードが重複しています: ${code}`);
    values.set(code, count(row[1]) + (kind === "clinic" ? count(row[5]) : 0));
  }
  return values;
}
