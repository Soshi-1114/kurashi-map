import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Vercel が付与する国コード（ISO 3166-1 alpha-2）。ローカル/セルフホストでは付かないため素通し
const BLOCKED_COUNTRIES = ['CN'];

export function middleware(request: NextRequest) {
  const country = request.headers.get('x-vercel-ip-country');
  if (country && BLOCKED_COUNTRIES.includes(country)) {
    return new NextResponse('403 Forbidden: Access from your region is not available.', {
      status: 403,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }
  return NextResponse.next();
}

export const config = {
  // 静的アセットは除外して middleware 実行回数を抑える（ページ・API・データ配信はすべて対象）
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
};
