// 送信済み・検出のみURLが現在のHTMLリンクから辿れるか調べる。
// Search Console のクロール理由を推定するツールではない。
import { createRequire } from "node:module";
import { RANKINGS } from "../../lib/rankings";
import { PREFS } from "../../lib/prefs";
import { readCohort } from "./indexInspection";

// jsdom is already a development dependency; only its standard DOM API is needed.
const { JSDOM } = createRequire(import.meta.url)("jsdom") as {
  JSDOM: new (html: string) => { window: { document: Document; close: () => void } };
};

export type PageLinks = { canonical: string | null; links: string[]; queryLinks: number };

export function extractPageLinks(html: string, pageUrl: string, origin: string): PageLinks {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const links = new Set<string>();
  let queryLinks = 0;
  for (const anchor of document.querySelectorAll("a[href]")) {
    const href = anchor.getAttribute("href");
    if (!href || href.startsWith("#")) continue;
    let url: URL;
    try { url = new URL(href, pageUrl); } catch { continue; }
    if (url.origin !== origin || !["http:", "https:"].includes(url.protocol)) continue;
    if (url.search) queryLinks++;
    links.add(url.pathname === "/" ? "/" : url.pathname.replace(/\/$/, ""));
  }
  const rawCanonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href");
  let canonical: string | null = null;
  try { if (rawCanonical) canonical = new URL(rawCanonical, pageUrl).href; } catch { /* malformed */ }
  dom.window.close();
  return { canonical, links: [...links], queryLinks };
}

export function shortestDepth(edges: Map<string, string[]>, start = "/"): Map<string, number> {
  const depths = new Map([[start, 0]]);
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    for (const next of edges.get(current) ?? []) {
      if (depths.has(next)) continue;
      depths.set(next, depths.get(current)! + 1);
      queue.push(next);
    }
  }
  return depths;
}

async function fetchPage(url: string): Promise<{ status: number; html: string }> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    return { status: response.status, html: response.ok ? await response.text() : "" };
  } catch { return { status: 0, html: "" }; }
}

async function main() {
  const args = new Map(process.argv.slice(2).map((arg) => {
    const [key, ...value] = arg.replace(/^--/, "").split("=");
    return [key, value.join("=")];
  }));
  const origin = new URL(args.get("base") ?? "https://kurashimap.jp").origin;
  const input = args.get("input") ?? "docs/seo/index-audit-2026-10-11.csv";
  const targets = readCohort(input, "https://kurashimap.jp").filter((url) => {
    // Input cohort contains all 370 URLs. Restrict this audit to the 93 discovered URLs.
    const line = targetRows.get(url);
    return line?.includes("検出 - インデックス未登録") ?? false;
  });
  const seeds = ["/", "/ranking", ...PREFS.map((p) => `/area/${p.slug}`),
    ...RANKINGS.map((r) => `/ranking/${r.slug}`)];
  const pages = new Map<string, { status: number; canonical: string | null; links: string[]; queryLinks: number }>();
  for (let i = 0; i < seeds.length; i += 8) {
    const batch = seeds.slice(i, i + 8);
    const results = await Promise.all(batch.map((path) => fetchPage(`${origin}${path}`)));
    batch.forEach((pagePath, j) => {
      const parsed = extractPageLinks(results[j].html, `${origin}${pagePath}`, origin);
      pages.set(pagePath, { status: results[j].status, ...parsed });
    });
  }
  const edges = new Map([...pages].map(([pagePath, page]) => [pagePath, page.links]));
  const depth = shortestDepth(edges);
  const results = targets.map((url) => {
    const path = new URL(url).pathname;
    const referrers = [...pages].filter(([, page]) => page.links.includes(path)).map(([source]) => source);
    return { url, depth: depth.get(path) ?? null, referrers,
      referrerCount: referrers.length };
  });
  const seedErrors = [...pages].filter(([, p]) => p.status !== 200).map(([url, p]) => ({ url, status: p.status }));
  process.stdout.write(JSON.stringify({ auditedAt: new Date().toISOString(), origin,
    scope: "top + prefecture hubs + national rankings", seedPages: pages.size,
    complete: seedErrors.length === 0, seedErrors,
    queryLinksObserved: [...pages.values()].reduce((sum, page) => sum + page.queryLinks, 0),
    canonicalMismatches: [...pages].filter(([pagePath, page]) => page.status === 200 && page.canonical !== `${origin}${pagePath}`)
      .map(([url, page]) => ({ url, canonical: page.canonical })),
    targets: results.length, linkedFromSeeds: results.filter((r) => r.referrerCount > 0).length,
    results }, null, 2) + "\n");
  if (seedErrors.length) process.exitCode = 1;
}

// CSV のURLにカンマはない。理由列は元の一覧をそのまま照合する。
const targetRows = new Map<string, string>();
if (process.argv[1] && /auditLinks\.[cm]?[jt]s$/.test(process.argv[1])) {
  const input = process.argv.find((arg) => arg.startsWith("--input="))?.slice(8) ?? "docs/seo/index-audit-2026-10-11.csv";
  import("node:fs").then(({ readFileSync }) => {
    for (const line of readFileSync(input, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/).slice(1)) {
      const url = line.split(",", 1)[0];
      if (url) targetRows.set(url, line);
    }
    return main();
  }).catch((error) => { console.error(error); process.exitCode = 1; });
}
