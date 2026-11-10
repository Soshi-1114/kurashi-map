import { getAdsenseConfig } from "@/lib/adsense";

// 設定をビルド時に確定し、ID の追加・変更時には必ず再デプロイする。
export const dynamic = "force-static";

export function GET() {
  const { clientId } = getAdsenseConfig();
  if (!clientId) return new Response("AdSense publisher is not configured.\n", { status: 404 });
  return new Response(`google.com, ${clientId.replace(/^ca-/, "")}, DIRECT, f08c47fec0942fa0\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
