import type { MetadataRoute } from "next";
import { SITE, absoluteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // /api/ 配下はデータAPI（muni/shelters 等）なのでクロール不可。ただし
      // /api/og/ は各ページの og:image。ブロックすると Google が画像を取得できず
      // GSC に「robots.txt でブロック」と出続けるため、ここだけ許可する。
      // robots.txt はより長い（具体的な）ルールが優先されるので allow が勝つ。
      { userAgent: "*", allow: ["/", "/api/og/"], disallow: ["/api/"] },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE.baseUrl,
  };
}
