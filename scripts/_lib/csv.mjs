// CSV 1行のパース（ダブルクォート囲み・囲み内カンマ・""エスケープ対応）。
// fetch-shelters.mjs（国土地理院CSV）・fetch-towns.mjs（Geolonia住所CSV）で共用。

export function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = false;
      } else cur += ch;
    } else if (ch === '"') {
      inQuote = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}
