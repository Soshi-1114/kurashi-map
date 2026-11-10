import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequest } from "./api";
import { collect } from "./collect";
import { readSnapshot, validDate } from "./model";
import { renderReport, summarize } from "./report";

export function parseArgs(argv: string[]) {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const [key, ...rest] = argv[i].split("=");
    if (!["--end", "--days", "--input", "--out"].includes(key)) throw new Error(`未対応の引数: ${key}`);
    const value = rest.length ? rest.join("=") : argv[++i];
    if (!value || value.startsWith("--") || args.has(key)) throw new Error(`引数が不正です: ${key}`);
    args.set(key, value);
  }
  if (args.has("--input") && (args.has("--end") || args.has("--days"))) throw new Error("--input再生成では--end/--daysを指定できません（保存条件を維持）");
  const end = args.get("--end"); if (end) validDate(end);
  const days = Number(args.get("--days") ?? 28);
  if (!Number.isInteger(days) || days < 1 || days > 90) throw new Error("--daysは1〜90の整数です");
  return { end, days, input: args.get("--input"), out: args.get("--out") };
}
export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  let snapshot;
  if (args.input) snapshot = readSnapshot(JSON.parse(fs.readFileSync(args.input, "utf8")));
  else {
    if (fs.existsSync(".env.local")) process.loadEnvFile(".env.local");
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    snapshot = await collect(await createRequest(), today, args.days, args.end, message => console.log(`[analytics] ${message}`));
  }
  const out = path.resolve(args.out ?? path.join("reports/gsc/analytics", new Date().toISOString().replace(/[:.]/g, "-")));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.mkdirSync(out); // 既存成果物を上書きしない
  const analysis = summarize(snapshot);
  fs.writeFileSync(path.join(out, "source.json"), JSON.stringify(snapshot, null, 2) + "\n");
  fs.writeFileSync(path.join(out, "analysis.json"), JSON.stringify(analysis, null, 2) + "\n");
  fs.writeFileSync(path.join(out, "summary.md"), renderReport(snapshot));
  console.log(`[analytics] ${args.input ? "保存データから再生成（API通信なし）" : "取得完了"}: ${out}`);
  if (!analysis.complete) { console.error("[analytics] 取得不足または品質通知あり。summary.mdを確認してください。"); process.exitCode = 2; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(`[analytics] ${error instanceof Error ? error.message : "実行失敗"}`); process.exitCode = 1; });
}
