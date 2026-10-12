import { describe, expect, it } from "vitest";
import { extractPageLinks, shortestDepth } from "@/scripts/gsc/auditLinks";

describe("HTMLリンク監査", () => {
  it("同一サイトの通常リンクを抽出し、クエリと外部リンクを区別する", () => {
    const html = '<link rel="canonical" href="/ranking/stations"><a href="/ranking/stations/kyoto?from=map">京都府</a><a href="https://other.example/">外部</a><a href="#table">表</a>';
    expect(extractPageLinks(html, "https://kurashimap.jp/ranking/stations", "https://kurashimap.jp"))
      .toEqual({ canonical: "https://kurashimap.jp/ranking/stations", links: ["/ranking/stations/kyoto"], queryLinks: 1 });
  });

  it("トップからの最短リンク数を数える", () => {
    const graph = new Map([["/", ["/ranking"]], ["/ranking", ["/ranking/stations"]], ["/ranking/stations", ["/ranking/stations/kyoto"]]]);
    expect(shortestDepth(graph).get("/ranking/stations/kyoto")).toBe(3);
  });
});
