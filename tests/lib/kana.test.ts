import { describe, it, expect } from "vitest";
import { toHiragana } from "@/lib/kana";

describe("toHiragana", () => {
  it("カタカナをひらがなに変換する", () => {
    expect(toHiragana("ムナカタ")).toBe("むなかた");
    expect(toHiragana("サッポロシチュウオウク")).toBe("さっぽろしちゅうおうく");
  });

  it("ひらがな・漢字・英数・長音符はそのまま", () => {
    expect(toHiragana("むなかた")).toBe("むなかた");
    expect(toHiragana("宗像市123")).toBe("宗像市123");
    expect(toHiragana("スーパー")).toBe("すーぱー");
  });

  it("混在文字列はカタカナ部分だけ変換する", () => {
    expect(toHiragana("宗像シ")).toBe("宗像し");
  });
});
