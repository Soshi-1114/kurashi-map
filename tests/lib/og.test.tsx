import { describe, expect, it } from "vitest";
import { ImageResponse } from "next/og";
import { OG_RESPONSE, OgFrame } from "@/lib/og";

describe("shared OG frame", () => {
  it("renders the embedded logo into a complete 1200×630 PNG", async () => {
    // Read the stream: constructing ImageResponse alone does not run the renderer.
    // ASCII content keeps this regression independent of remote font downloads.
    const response = new ImageResponse(<OgFrame><div>OG rendering check</div></OgFrame>, OG_RESPONSE);
    const png = Buffer.from(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  }, 20_000);
});
