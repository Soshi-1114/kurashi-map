// デザイントークンのドリフト検出。
//
// 配色の出どころは app/globals.css の :root ただ1箇所だが、そこを参照できない場所が2つある。
//   - OG画像（Satori）は CSS 変数を解決できないので lib/og.tsx に値を写している
//   - viewport.themeColor（ブラウザクローム）は lib/site.ts の brandColor
// 写した値が本体とズレるのを防ぐため、実ファイルを読んで突き合わせる。
//
// あわせて「入れてはいけない色」も見張る。
//   - コロプレス配色（RENT_COLORS）を CSS へ複製しない（TS 側が唯一の出どころ）
//   - 退役したパレット（アイボリー＋テラコッタ、旧ブルー）が CSS へ戻ってこない

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { OG } from "@/lib/og";
import { SITE } from "@/lib/site";
import { RENT_COLORS, RENT_NODATA_COLOR } from "@/lib/rentColor";

const ROOT = join(__dirname, "..", "..");

/** リポジトリ内の CSS ファイルをすべて集める（node_modules / .next は除く）。 */
function cssFiles(dir = join(ROOT, "app"), acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) cssFiles(p, acc);
    else if (e.name.endsWith(".css")) acc.push(p);
  }
  return acc;
}

const CSS_PATHS = cssFiles();
const globals = readFileSync(join(ROOT, "app", "globals.css"), "utf8");

/** globals.css の :root ブロックから `--name: value;` を拾う。 */
function rootTokens(): Map<string, string> {
  const start = globals.indexOf(":root {");
  expect(start).toBeGreaterThanOrEqual(0);
  // :root は入れ子を持たないので、最初の "\n}" までを本体とみなす
  const end = globals.indexOf("\n}", start);
  const body = globals.slice(start, end);
  const map = new Map<string, string>();
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    map.set(m[1], m[2].trim());
  }
  return map;
}

const tokens = rootTokens();

describe("globals.css の :root", () => {
  it("トークンを読み出せる", () => {
    expect(tokens.size).toBeGreaterThan(30);
    expect(tokens.get("--color-primary")).toBeDefined();
  });
});

describe("OG画像の配色（lib/og.tsx）が :root と一致する", () => {
  // OG の各キー → 対応する CSS カスタムプロパティ
  const MAPPING: Record<keyof typeof OG, string> = {
    primary: "--color-primary",
    primaryHover: "--color-primary-hover",
    primaryBg: "--color-primary-bg",
    primarySubtle: "--color-primary-subtle",
    surface: "--color-surface",
    ink: "--color-ink",
    inkMuted: "--color-ink-muted",
    line: "--color-line",
  };

  it.each(Object.entries(MAPPING))("OG.%s は %s と同値", (key, cssVar) => {
    const expected = tokens.get(cssVar);
    expect(expected, `${cssVar} が :root に無い`).toBeDefined();
    expect(OG[key as keyof typeof OG].toLowerCase()).toBe(expected!.toLowerCase());
  });

  it("OG のキーはすべてマッピングされている（新色の追加漏れを検出）", () => {
    expect(Object.keys(OG).sort()).toEqual(Object.keys(MAPPING).sort());
  });
});

describe("themeColor（lib/site.ts）が :root と一致する", () => {
  it("SITE.brandColor === --color-primary", () => {
    expect(SITE.brandColor.toLowerCase()).toBe(tokens.get("--color-primary")!.toLowerCase());
  });
});

describe("コロプレス配色を CSS へ複製しない", () => {
  // 地図の家賃コロプレスは lib/rentColor.ts が唯一の出どころ。CSS 側に同じ hex を
  // 書くと片方だけ更新されて静かにズレる（実際に .rent-bar-track で起きていた）。
  it.each([...RENT_COLORS, RENT_NODATA_COLOR])("%s が CSS に出現しない", (hex) => {
    const hits = CSS_PATHS.filter((p) =>
      readFileSync(p, "utf8").toLowerCase().includes(hex.toLowerCase()),
    ).map((p) => p.slice(ROOT.length + 1));
    expect(hits, `コロプレス色 ${hex} は CSS に書かず lib/rentColor.ts から流し込むこと`).toEqual([]);
  });
});

describe("退役したパレットが CSS に戻っていない", () => {
  // 旧テーマ（アイボリー地＋テラコッタ）と、それ以前のブルー。
  // ブランドカラーは --color-primary 系に一本化済みで、これらは復活させない。
  const RETIRED = [
    "#c75b39", // テラコッタ accent
    "#a84a2d", // テラコッタ accent hover
    "#e08a6b", // テラコッタ CTA グラデ上端
    "#e89b7e", // テラコッタ 比較バー
    "#8a3c24", // テラコッタ CTA グラデ下端
    "#fbfaf6", // アイボリー地
    "#f4f1e8", // アイボリー淡色パネル
    "#fbf7ee", // クリーム（ヒーロー帯）
    "#f5f8fc", // 旧・地図ページの地色
    "#1d4ed8", // 旧ブルー accent hover
    "#5b8bf0", // 旧ブルー CTA グラデ上端
  ];

  it.each(RETIRED)("%s が CSS に出現しない", (hex) => {
    const hits = CSS_PATHS.filter((p) =>
      readFileSync(p, "utf8").toLowerCase().includes(hex.toLowerCase()),
    ).map((p) => p.slice(ROOT.length + 1));
    expect(hits).toEqual([]);
  });

  it("テラコッタの rgba 表記も残っていない", () => {
    const hits = CSS_PATHS.filter((p) => /rgba\(\s*199,\s*91,\s*57/.test(readFileSync(p, "utf8")))
      .map((p) => p.slice(ROOT.length + 1));
    expect(hits).toEqual([]);
  });
});
