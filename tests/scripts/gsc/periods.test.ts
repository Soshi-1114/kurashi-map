import { describe, it, expect } from "vitest";
import { addDays, parseRangeArg, resolvePeriods } from "../../../scripts/gsc/periods";

const BASE = { days: 28, today: "2026-09-10", lagDays: 3 } as const;

describe("addDays", () => {
  it("月をまたいでも正しく進む/戻る", () => {
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("parseRangeArg", () => {
  it("YYYY-MM-DD..YYYY-MM-DD を解析する", () => {
    expect(parseRangeArg("2026-07-11..2026-08-07", "--baseline")).toEqual({
      startDate: "2026-07-11",
      endDate: "2026-08-07",
    });
  });

  it("書式不正・逆順は分かるエラーにする", () => {
    expect(() => parseRangeArg("2026-07-11", "--baseline")).toThrow(/YYYY-MM-DD\.\.YYYY-MM-DD/);
    expect(() => parseRangeArg("2026-13-01..2026-13-02", "--baseline")).toThrow(/YYYY-MM-DD/);
    expect(() => parseRangeArg("2026-08-07..2026-07-11", "--baseline")).toThrow(/開始日が終了日より後/);
  });
});

describe("resolvePeriods", () => {
  it("compare なしは直近days日のみ（データ確定ラグを引く）", () => {
    const p = resolvePeriods({ ...BASE, compareMode: "none" });
    expect(p.current).toMatchObject({ startDate: "2026-08-11", endDate: "2026-09-07" });
    expect(p.previous).toBeNull();
  });

  it("adjacent は直前の同じ長さの期間", () => {
    const p = resolvePeriods({ ...BASE, compareMode: "adjacent" });
    expect(p.previous).toMatchObject({ startDate: "2026-07-14", endDate: "2026-08-10" });
  });

  it("yoy は365日前", () => {
    const p = resolvePeriods({ ...BASE, compareMode: "yoy" });
    expect(p.previous).toMatchObject({ startDate: "2025-08-11", endDate: "2025-09-07" });
  });

  it("baseline は任意期間を比較対象にする", () => {
    const p = resolvePeriods({ ...BASE, compareMode: "baseline", baseline: "2026-07-11..2026-08-07" });
    expect(p.previous).toMatchObject({ startDate: "2026-07-11", endDate: "2026-08-07" });
    expect(p.warning).toBeUndefined(); // 28日ぴったりなので警告なし
  });

  it("baseline の日数が違うときは合計値の比較を戒める警告を出す", () => {
    const p = resolvePeriods({ ...BASE, compareMode: "baseline", baseline: "2026-07-01..2026-08-07" });
    expect(p.warning).toMatch(/長さが違います/);
  });

  it("since は起点日の前後で同じ日数を切り出す", () => {
    // 起点 8/1、28日 → 後=8/1〜8/28、前=7/4〜7/31
    const p = resolvePeriods({ ...BASE, compareMode: "since", since: "2026-08-01" });
    expect(p.current).toMatchObject({ startDate: "2026-08-01", endDate: "2026-08-28" });
    expect(p.previous).toMatchObject({ startDate: "2026-07-04", endDate: "2026-07-31" });
    expect(p.warning).toBeUndefined();
  });

  it("since の「後」がデータ確定終端に届かない場合は切り詰めて警告する", () => {
    // 起点 9/1、28日 → 9/28 まで欲しいがデータは 9/7 まで
    const p = resolvePeriods({ ...BASE, compareMode: "since", since: "2026-09-01" });
    expect(p.current).toMatchObject({ startDate: "2026-09-01", endDate: "2026-09-07" });
    expect(p.current.label).toContain("7日");
    // 「前」は指定どおり28日ぶん確保する（母数が違うことは警告で伝える）
    expect(p.previous).toMatchObject({ startDate: "2026-08-04", endDate: "2026-08-31" });
    expect(p.warning).toMatch(/揃っていない/);
  });

  it("since がデータ確定終端より後なら、測るには早すぎるとエラーにする", () => {
    expect(() => resolvePeriods({ ...BASE, compareMode: "since", since: "2026-09-20" })).toThrow(
      /まだ早すぎます/,
    );
  });

  it("必要な引数が無い場合は分かるエラーにする", () => {
    expect(() => resolvePeriods({ ...BASE, compareMode: "since" })).toThrow(/--since には起点日/);
    expect(() => resolvePeriods({ ...BASE, compareMode: "baseline" })).toThrow(/--baseline には期間/);
  });
});
