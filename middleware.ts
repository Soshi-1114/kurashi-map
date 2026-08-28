import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 許可する国（ISO 3166-1 alpha-2）。Vercel が付与する x-vercel-ip-country で判定し、
// ヘッダーが付かないローカル/セルフホスト環境では素通し
const ALLOWED_COUNTRIES = ['JP'];

// UA・パスによる例外を一切適用せず、常に 403 を返す国。
// 一般トラフィックは ALLOWED_COUNTRIES だけで弾けるが、下の ALLOWED_BOT_UA は
// UA 文字列を見るだけなので「Googlebot を名乗る一般クライアント」は通ってしまう。
// ここに挙げた国からの正規クローラー（Googlebot / Bingbot 等）は存在しないため、
// クローラーを名乗るリクエストは UA 偽装とみなして一律で拒否する。
// 中国向け検索エンジン（Baidu / Sogou / 360）にもインデックスさせない方針。
const DENIED_COUNTRIES = ['CN'];

// 検索エンジンや SNS のカード生成クローラーは国外 IP から来るため UA で通す。
// UA は偽装可能だが、一般トラフィックの地域制限としては十分
// （Google系 / Bing / Apple / DuckDuckGo / Naver(yeti) / LINE / X / Facebook / Slack / Discord / LinkedIn）。
// GoogleOther（発見・調査用）・Google-Extended・Storebot-Google も許可
// （403 を返すとインデックス評価に不利）。
// AI 検索系（OpenAI / Anthropic / Perplexity / Amazon）は AIO 経由の流入元として許可。
const ALLOWED_BOT_UA =
  /googlebot|google-inspectiontool|google-extended|googleother|adsbot-google|apis-google|mediapartners-google|storebot-google|bingbot|bingpreview|msnbot|applebot|duckduckbot|yeti|linespider|twitterbot|facebookexternalhit|slackbot|discordbot|linkedinbot|gptbot|oai-searchbot|chatgpt-user|claudebot|claude-web|perplexitybot|amazonbot/i;

// クロールの起点となるファイルは国・UA を問わず公開（DENIED_COUNTRIES は除く）
const PUBLIC_PATHS = ['/robots.txt', '/sitemap.xml'];

function forbidden(): NextResponse {
  return new NextResponse('403 Forbidden: Access from your region is not available.', {
    status: 403,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

export function middleware(request: NextRequest) {
  const country = request.headers.get('x-vercel-ip-country');
  if (country && DENIED_COUNTRIES.includes(country)) {
    return forbidden();
  }

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

  return forbidden();
}

export const config = {
  // 静的アセットは除外して middleware 実行回数を抑える（ページ・API・データ配信はすべて対象）
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
};
