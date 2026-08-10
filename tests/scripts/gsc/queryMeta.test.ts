import { describe, it, expect } from "vitest";
import { buildMuniNameMatcher, classifyQuery, normalizeQuery } from "../../../scripts/gsc/queryMeta";
import type { MuniMeta } from "../../../scripts/gsc/types";

function muniMaster(): Map<string, MuniMeta> {
  const m = new Map<string, MuniMeta>();
  m.set("40203", {
    code: "40203",
    prefSlug: "fukuoka",
    prefNameJa: "福岡県",
    name: "宗像市",
    displayName: "宗像市",
    url: "/area/fukuoka/40203",
  });
  m.set("26100", {
    code: "26100",
    prefSlug: "kyoto",
    prefNameJa: "京都府",
    name: "京都市",
    displayName: "京都市",
    url: "/area/kyoto/26100",
  });
  return m;
}

describe("normalizeQuery", () => {
  it("前後の空白を除き、連続空白を1つにする", () => {
    expect(normalizeQuery("  宗像市   住みやすさ  ")).toBe("宗像市 住みやすさ");
  });
});

describe("classifyQuery", () => {
  const matcher = buildMuniNameMatcher(muniMaster());

  it("ブランドクエリを branded に分類する（自治体名を含んでいても優先）", () => {
    expect(classifyQuery("くらしマップ 京都市", matcher)).toBe("branded");
    expect(classifyQuery("kurashimap", matcher)).toBe("branded");
  });

  it("自治体名を含むクエリを municipality に分類する", () => {
    expect(classifyQuery("宗像市 住みやすさ", matcher)).toBe("municipality");
  });

  it("長い自治体名を優先して一致させる（例: 京都市 > 京都）", () => {
    expect(classifyQuery("京都市 家賃相場", matcher)).toBe("municipality");
  });

  it("テーマ別クエリを分類する", () => {
    expect(classifyQuery("治安が悪い街", matcher)).toBe("safety");
    expect(classifyQuery("待機児童 少ない", matcher)).toBe("child");
    expect(classifyQuery("家賃相場", matcher)).toBe("money");
    expect(classifyQuery("ハザードマップ 洪水", matcher)).toBe("disaster");
    expect(classifyQuery("人口推移", matcher)).toBe("population");
    expect(classifyQuery("病院 近く", matcher)).toBe("medical");
    expect(classifyQuery("住みやすい街", matcher)).toBe("livability");
  });

  it("どれにも該当しないクエリは other", () => {
    expect(classifyQuery("引っ越し 準備", matcher)).toBe("other");
  });
});
