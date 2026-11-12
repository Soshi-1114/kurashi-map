import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Vercel が付与する x-vercel-ip-country（ISO 3166-1 alpha-2）で判定する。
// 中国・ベトナムからは UA・パスを問わず拒否し、それ以外の国は許可する。
// 国ヘッダーが付かないローカル/セルフホスト環境も許可する。
const DENIED_COUNTRIES = ['CN', 'VN'];

function forbidden(): NextResponse {
  return new NextResponse('403 Forbidden: Access from your region is not available.', {
    status: 403,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

export function proxy(request: NextRequest) {
  const country = request.headers.get('x-vercel-ip-country');
  if (country && DENIED_COUNTRIES.includes(country)) {
    return forbidden();
  }

  return NextResponse.next();
}

export const config = {
  // 静的アセットは除外して proxy 実行回数を抑える（ページ・API・データ配信はすべて対象）
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
};
