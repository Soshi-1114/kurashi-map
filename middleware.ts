import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 許可する国（ISO 3166-1 alpha-2）。Vercel が付与する x-vercel-ip-country で判定し、
// ヘッダーが付かないローカル/セルフホスト環境では素通し
const ALLOWED_COUNTRIES = ['JP'];

// 検索エンジンや SNS のカード生成クローラーは国外 IP から来るため UA で通す。
// UA は偽装可能だが、一般トラフィックの地域制限としては十分
// （Google系 / Bing / Apple / DuckDuckGo / Naver(yeti) / LINE / X / Facebook / Slack / Discord / LinkedIn）
const ALLOWED_BOT_UA =
  /googlebot|google-inspectiontool|adsbot-google|apis-google|mediapartners-google|bingbot|bingpreview|msnbot|applebot|duckduckbot|yeti|linespider|twitterbot|facebookexternalhit|slackbot|discordbot|linkedinbot/i;

// クロールの起点となるファイルは国・UA を問わず公開
const PUBLIC_PATHS = ['/robots.txt', '/sitemap.xml'];

export function middleware(request: NextRequest) {
  const country = request.headers.get('x-vercel-ip-country');
  if (!country || ALLOWED_COUNTRIES.includes(country)) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.includes(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const userAgent = request.headers.get('user-agent') ?? '';
  if (ALLOWED_BOT_UA.test(userAgent)) {
    return NextResponse.next();
  }

  return new NextResponse('403 Forbidden: Access from your region is not available.', {
    status: 403,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

export const config = {
  // 静的アセットは除外して middleware 実行回数を抑える（ページ・API・データ配信はすべて対象）
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
};
