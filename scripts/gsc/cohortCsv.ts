import fs from "node:fs";

/** CSVの引用符・改行・BOMを解釈し、列名で対象理由を選ぶ。 */
export function parseCohortCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '"') {
      if (quoted && input[i + 1] === '"') { field += '"'; i++; }
      else if (quoted || field === "") quoted = !quoted;
      else throw new Error("不正なCSV引用符です");
    } else if (char === "," && !quoted) {
      row.push(field); field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = []; field = "";
    } else field += char;
  }
  if (quoted) throw new Error("CSVの引用符が閉じていません");
  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  const headers = rows.shift()?.map((header) => header.trim()) ?? [];
  if (!headers.includes("url") || new Set(headers).size !== headers.length) throw new Error("CSVに一意なurl列が必要です");
  return rows.map((values) => {
    if (values.length !== headers.length) throw new Error("CSVの列数が一致しません");
    return Object.fromEntries(headers.map((header, i) => [header, values[i]]));
  });
}

export function readCohortRows(file: string): Record<string, string>[] {
  return parseCohortCsv(fs.readFileSync(file, "utf8"));
}

export function selectDiscoveredUrls(rows: Record<string, string>[]): Set<string> {
  if (!rows.length || !("gsc_reason_2026_10_04" in rows[0])) throw new Error("リンク監査にはgsc_reason_2026_10_04列が必要です");
  return new Set(rows.filter((row) => row.gsc_reason_2026_10_04 === "検出 - インデックス未登録").map((row) => row.url.trim()));
}
