import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';

function requestOf(opts: { country?: string; ua?: string; path?: string } = {}): NextRequest {
  const headers = new Headers();
  if (opts.country) headers.set('x-vercel-ip-country', opts.country);
  if (opts.ua) headers.set('user-agent', opts.ua);
  return new NextRequest(`https://kurashi-map.example${opts.path ?? '/area/tokyo/13104'}`, {
    headers,
  });
}

const paths = ['/', '/area/saitama/11203', '/api/muni/11203', '/robots.txt', '/sitemap.xml', '/ads.txt'];
const userAgents = [
  undefined,
  'Mozilla/5.0',
  'Google-Display-Ads-Bot',
  'Mediapartners-Google',
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Twitterbot/1.0',
  'UnknownBot/1.0',
];

describe('proxy (geo block)', () => {
  describe.each(['CN', 'VN'])('%s からのアクセス', country => {
    it.each(paths)('%s は UA を問わず 403 で拒否する', path => {
      for (const ua of userAgents) {
        const response = proxy(requestOf({ country, ua, path }));
        expect(response.status).toBe(403);
        expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
      }
    });
  });

  describe.each(['JP', 'US', 'IE', 'GB', 'KR', 'TW', 'SG', 'AU', 'BR'])('%s からのアクセス', country => {
    it.each(paths)('%s は一般ブラウザ・クローラーともに許可する', path => {
      for (const ua of userAgents) {
        expect(proxy(requestOf({ country, ua, path })).headers.get('x-middleware-next')).toBe('1');
      }
    });
  });

  it.each(paths)('国ヘッダーがない場合も %s を許可する', path => {
    expect(proxy(requestOf({ path })).headers.get('x-middleware-next')).toBe('1');
  });
});
