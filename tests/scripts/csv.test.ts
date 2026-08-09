import { describe, it, expect } from "vitest";
// @ts-expect-error mjs モジュール（データスクリプト共通ヘルパー）に型定義はない
import { parseCsvLine } from "../../scripts/_lib/csv.mjs";

describe("parseCsvLine", () => {
  it("クォート囲み・非囲み・空フィールドの混在を分解する", () => {
    expect(parseCsvLine('"01","北海道",,"札幌市中央区",1.5')).toEqual(["01", "北海道", "", "札幌市中央区", "1.5"]);
  });

  it("囲み内のカンマと \"\" エスケープを扱う", () => {
    expect(parseCsvLine('"a,b","say ""hi""",c')).toEqual(["a,b", 'say "hi"', "c"]);
  });
});
