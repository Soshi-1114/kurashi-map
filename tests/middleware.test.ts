import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

function requestOf(opts: { country?: string; ua?: string; path?: string } = {}): NextRequest {
  const headers = new Headers();
  if (opts.country) headers.set('x-vercel-ip-country', opts.country);
  if (opts.ua) headers.set('user-agent', opts.ua);
  return new NextRequest(`https://kurashi-map.example${opts.path ?? '/area/tokyo/shinjuku'}`, {
    headers,
  });
}

describe('middleware (geo block)', () => {
  it('JP からのリクエストは通す', () => {
    expect(middleware(requestOf({ country: 'JP' })).status).toBe(200);
  });

  it('国ヘッダーなし（ローカル環境）は通す', () => {
    expect(middleware(requestOf()).status).toBe(200);
  });

  it('日本以外からの一般アクセスを 403 で拒否する', () => {
    expect(middleware(requestOf({ country: 'US', ua: 'Mozilla/5.0' })).status).toBe(403);
    expect(middleware(requestOf({ country: 'CN', ua: 'Mozilla/5.0' })).status).toBe(403);
  });

  it('国外からでも検索エンジンクローラーは通す', () => {
    const googlebot =
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
    expect(middleware(requestOf({ country: 'US', ua: googlebot })).status).toBe(200);
    const bingbot = 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)';
    expect(middleware(requestOf({ country: 'US', ua: bingbot })).status).toBe(200);
  });

  it('国外からでも SNS カード生成クローラーは通す', () => {
    expect(middleware(requestOf({ country: 'US', ua: 'Twitterbot/1.0' })).status).toBe(200);
    expect(
      middleware(requestOf({ country: 'IE', ua: 'facebookexternalhit/1.1' })).status,
    ).toBe(200);
  });

  it('robots.txt と sitemap.xml は国・UA を問わず公開', () => {
    expect(middleware(requestOf({ country: 'US', path: '/robots.txt' })).status).toBe(200);
    expect(middleware(requestOf({ country: 'US', path: '/sitemap.xml' })).status).toBe(200);
  });
});
