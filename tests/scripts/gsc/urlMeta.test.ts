import { describe, it, expect } from "vitest";
import { classifyUrl, loadMuniMaster, normalizeUrlPath } from "../../../scripts/gsc/urlMeta";
import type { MuniMeta } from "../../../scripts/gsc/types";

function muniMaster(): Map<string, MuniMeta> {
  const m = new Map<string, MuniMeta>();
  m.set("11203", {
    code: "11203",
    prefSlug: "saitama",
    prefNameJa: "埼玉県",
    name: "川口市",
    displayName: "川口市",
    url: "/area/saitama/11203",
  });
  return m;
}

describe("normalizeUrlPath", () => {
  it("フルURLからパスだけを取り出し、末尾スラッシュを除く", () => {
    expect(normalizeUrlPath("https://kurashimap.jp/area/saitama/11203/")).toBe("/area/saitama/11203");
  });
  it("すでにパスのみの場合はそのまま扱う", () => {
    expect(normalizeUrlPath("/ranking/rent-cheap")).toBe("/ranking/rent-cheap");
  });
  it("ルートはそのまま /", () => {
    expect(normalizeUrlPath("https://kurashimap.jp/")).toBe("/");
  });
});

describe("classifyUrl", () => {
  const master = muniMaster();

  it("トップページを top に分類する", () => {
    expect(classifyUrl("https://kurashimap.jp/", master).pageType).toBe("top");
  });

  it("/area/{pref} を prefecture に分類する", () => {
    const meta = classifyUrl("https://kurashimap.jp/area/saitama", master);
    expect(meta.pageType).toBe("prefecture");
    expect(meta.prefSlug).toBe("saitama");
    expect(meta.prefNameJa).toBe("埼玉県");
  });

  it("/area/{pref}/{code} を municipality に分類し、マスタから名称を補う", () => {
    const meta = classifyUrl("https://kurashimap.jp/area/saitama/11203", master);
    expect(meta.pageType).toBe("municipality");
    expect(meta.muniCode).toBe("11203");
    expect(meta.muniName).toBe("川口市");
  });

  it("マスタに無い自治体コードでも municipality には分類する（名称は付かない）", () => {
    const meta = classifyUrl("https://kurashimap.jp/area/saitama/99999", master);
    expect(meta.pageType).toBe("municipality");
    expect(meta.muniName).toBeUndefined();
  });

  it("/ranking/{slug}/{pref} を ranking に分類し slug・pref を保持する", () => {
    const meta = classifyUrl("https://kurashimap.jp/ranking/rent-cheap/saitama", master);
    expect(meta.pageType).toBe("ranking");
    expect(meta.rankingSlug).toBe("rent-cheap");
    expect(meta.prefSlug).toBe("saitama");
  });

  it("/map/{metric} を map に分類する", () => {
    const meta = classifyUrl("https://kurashimap.jp/map/rent", master);
    expect(meta.pageType).toBe("map");
    expect(meta.mapMetric).toBe("rent");
  });

  it("/compare, /about は compare / about に分類する", () => {
    expect(classifyUrl("https://kurashimap.jp/compare", master).pageType).toBe("compare");
    expect(classifyUrl("https://kurashimap.jp/about", master).pageType).toBe("about");
  });

  it("該当しないパスは other に分類する", () => {
    expect(classifyUrl("https://kurashimap.jp/search", master).pageType).toBe("other");
  });
});

describe("loadMuniMaster（実データ）", () => {
  it("全自治体（1,900件超）を code キーで読み込む", () => {
    const master = loadMuniMaster();
    expect(master.size).toBeGreaterThan(1900);
    const saitama = master.get("11203");
    expect(saitama?.name).toBe("川口市");
    expect(saitama?.url).toBe("/area/saitama/11203");
  });
});
