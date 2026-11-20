// HTTP checks only; never request or click real ads.
import assert from 'node:assert/strict';
const base = process.argv[2] ?? 'http://127.0.0.1:3141';
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base)) throw new Error('Local server URL required');
const slugs = ['foreign-resident-growth', 'foreign-resident-growth-rate', 'foreign-student-elementary-ratio', 'foreign-student-junior-ratio'];
for (const slug of slugs) {
  const path = `/ranking/${slug}`;
  const response = await fetch(base + path);
  assert.equal(response.status, 200, path);
  const html = await response.text();
  assert.ok(html.includes(`rel="canonical" href="https://kurashimap.jp${path}"`), 'canonical');
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1, 'one H1');
  assert.equal((html.match(/<tbody>/g) ?? []).length, 2, 'first ten and remainder in initial HTML');
  const tables = [...html.matchAll(/<tbody>([\s\S]*?)<\/tbody>/g)];
  assert.equal((tables[0][1].match(/<tr\b/g) ?? []).length, 10);
  assert.equal(tables.reduce((n, t) => n + (t[1].match(/<tr\b/g) ?? []).length, 0), slug.includes('student') ? 47 : 100);
  assert.ok(html.includes('公的データの出典・定義'));
  assert.ok(html.includes('https://www.e-stat.go.jp/'));
  assert.ok(html.includes('application/ld+json'));
  assert.ok(html.includes('/map/foreign-resident-issues?tab='));
  const ads = (html.match(/data-ad-placement="ranking"/g) ?? []).length;
  assert.ok(ads <= 1, 'at most one ad');
  if (ads) assert.ok(html.indexOf('data-ad-placement="ranking"') > html.indexOf('</tbody>'), 'ad after top ten');
  console.log(`OK ${path}: ${slug.includes('student') ? 47 : 100} SSR rows / ${ads} ad`);
}
const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
for (const slug of slugs) assert.equal((sitemap.match(new RegExp(`<loc>https://kurashimap.jp/ranking/${slug}</loc>`, 'g')) ?? []).length, 1);
for (const path of ['/ranking', '/ranking/foreign-ratio-high', '/ranking/foreign-ratio-high/saitama', '/map/foreign-resident-issues']) {
  const response = await fetch(base + path);
  assert.equal(response.status, 200, path);
  const html = await response.text();
  assert.ok(html.includes('/ranking/foreign-resident-growth'), 'related ranking link');
  if (path.startsWith('/map/')) assert.equal((html.match(/data-ad-placement=/g) ?? []).length, 0, 'no map ad');
  console.log(`OK related links ${path}`);
}
console.log('OK sitemap / existing routes / new map has no ad');
