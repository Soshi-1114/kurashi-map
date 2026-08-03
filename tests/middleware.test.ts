import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

function requestFrom(country?: string): NextRequest {
  const headers = new Headers();
  if (country) headers.set('x-vercel-ip-country', country);
  return new NextRequest('https://kurashi-map.example/area/tokyo/shinjuku', { headers });
}

describe('middleware (geo block)', () => {
  it('CN からのリクエストを 403 で拒否する', async () => {
    const res = middleware(requestFrom('CN'));
    expect(res.status).toBe(403);
  });

  it('JP からのリクエストは通す', () => {
    const res = middleware(requestFrom('JP'));
    expect(res.status).toBe(200);
  });

  it('国ヘッダーなし（ローカル環境）は通す', () => {
    const res = middleware(requestFrom());
    expect(res.status).toBe(200);
  });
});
