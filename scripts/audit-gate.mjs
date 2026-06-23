// npm audit を CI のゲートにする自己完結スクリプト（追加 npm 依存なし）。
//
// 方針:
//   - 既定しきい値 high 以上の脆弱性で CI を落とす（critical も当然落とす）。
//   - 「トリアージ済みで当アプリに非該当 / メジャー更新でしか直らない」advisory は
//     ALLOW に GHSA ID と理由を明記して除外する。新規に出た未トリアージの
//     high/critical は ID が一致せず必ず落ちるため、ゲートとして機能する。
//   - moderate / low は参考表示のみ（ブロックしない）。
//
// 実行: node scripts/audit-gate.mjs            （しきい値 high）
//       node scripts/audit-gate.mjs --level=critical
//
// 許可リストは「恒久免除」ではなく「次のメジャー更新で解消する宿題」。
// Dependabot（.github/dependabot.yml）が next 15 系・vitest 3 系の更新 PR を上げてきたら、
// アプリ互換性を確認のうえ更新し、対応する ID を本リストから削除すること。

import { execFileSync } from "node:child_process";

const RANK = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };

// しきい値（--level=... で上書き可。既定 high）。
const levelArg = process.argv.find((a) => a.startsWith("--level="));
const THRESHOLD = RANK[levelArg ? levelArg.split("=")[1] : "high"] ?? RANK.high;

// GHSA ID → 免除理由。high/critical のみ列挙（moderate 以下は非ブロックなので不要）。
const ALLOW = {
  // ---- next: 14.2.35 は 14.2 系の最新。残 advisory の修正はメジャー(15+)更新が必要。
  //      当アプリは Vercel 上の App Router + SSG で、self-hosted / middleware / i18n /
  //      next/image remotePatterns / rewrites / Pages Router をいずれも使わないため
  //      下記はいずれも実行経路上は非該当。Dependabot が 15 系更新 PR を上げる。
  "GHSA-h25m-26qc-wcjf": "next: RSC HTTP deserialization DoS。insecure RSC 構成に依存、非該当。next 15 で修正。",
  "GHSA-q4gf-8mx6-v5v3": "next: Server Components DoS。next 15 で修正。",
  "GHSA-8h8q-6873-q5fj": "next: Server Components DoS。next 15 で修正。",
  "GHSA-c4j6-fc7j-m34r": "next: WebSocket upgrade を使うアプリの SSRF。当アプリ未使用、非該当。next 15 で修正。",
  "GHSA-36qx-fr4f-26g5": "next: Pages Router + i18n の middleware bypass。App Router のみ・i18n 未使用、非該当。",

  // ---- dev テストツール（vitest/vite/esbuild）: いずれも dev サーバ / Vitest UI を
  //      起動した時のみ成立する脆弱性。本リポジトリは `vitest run`（CI/ローカルとも）で
  //      UI も dev サーバも起動しないため非該当。ランタイム成果物にも含まれない。
  "GHSA-5xrq-8626-4rwp": "vitest: Vitest UI サーバ起動時の任意ファイル読取。`vitest run` 運用で UI 不使用、非該当。",
  "GHSA-fx2h-pf6j-xcff": "vite: Windows の server.fs.deny バイパス。dev サーバ不使用、非該当。",
};

function getAudit() {
  try {
    // 脆弱性ありだと npm audit は非ゼロ終了するため stdio で stdout を捕捉する。
    return execFileSync("npm", ["audit", "--json"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    if (e.stdout) return e.stdout;
    throw e;
  }
}

const report = JSON.parse(getAudit());
const advisories = new Map(); // GHSA url -> {id, severity, title, module}
for (const [name, v] of Object.entries(report.vulnerabilities ?? {})) {
  for (const via of v.via ?? []) {
    if (typeof via === "object" && via.url) {
      const id = via.url.split("/").pop();
      advisories.set(via.url, { id, severity: via.severity, title: via.title, module: name });
    }
  }
}

const blockers = [];
const allowed = [];
const belowThreshold = [];
for (const a of advisories.values()) {
  const rank = RANK[a.severity] ?? 0;
  if (rank < THRESHOLD) { belowThreshold.push(a); continue; }
  if (ALLOW[a.id]) allowed.push(a);
  else blockers.push(a);
}

const fmt = (a) => `  ${a.severity.toUpperCase().padEnd(8)} ${a.id.padEnd(22)} ${a.module.padEnd(10)} ${a.title.slice(0, 70)}`;

const levelName = Object.keys(RANK).find((k) => RANK[k] === THRESHOLD);
console.log(`npm audit gate — しきい値: ${levelName}+\n`);

if (belowThreshold.length) {
  console.log(`しきい値未満（参考・非ブロック）: ${belowThreshold.length} 件`);
}
if (allowed.length) {
  console.log(`\nトリアージ済みで免除（${allowed.length} 件）:`);
  for (const a of allowed) {
    console.log(fmt(a));
    console.log(`           ↳ ${ALLOW[a.id]}`);
  }
}
if (blockers.length) {
  console.log(`\n❌ 未トリアージの ${levelName}+ 脆弱性 ${blockers.length} 件:`);
  for (const a of blockers) console.log(fmt(a));
  console.log("\n対応: 修正版へ更新するか、当アプリで非該当と確認のうえ scripts/audit-gate.mjs の ALLOW に理由付きで追加すること。");
  process.exit(1);
}

console.log(`\n✅ ${levelName}+ の未トリアージ脆弱性なし。`);
