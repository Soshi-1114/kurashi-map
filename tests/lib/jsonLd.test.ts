import { describe, expect, it } from "vitest";
import { serializeJsonLd } from "@/lib/jsonLd";

describe("serializeJsonLd", () => {
  it("script 終端をHTMLとして解釈させず、元の値は復元できる", () => {
    const payload = { name: '</script><script>alert("x")</script>' };
    const serialized = serializeJsonLd(payload);
    expect(serialized).not.toContain("<");
    expect(JSON.parse(serialized)).toEqual(payload);
  });
});
