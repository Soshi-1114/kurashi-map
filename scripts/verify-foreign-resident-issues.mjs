// Read-only HTTP smoke check against a running local dev or production server.
import assert from 'node:assert/strict';
const base = process.argv[2] ?? 'http://127.0.0.1:3140';
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base)) throw new Error('Local server URL required');
const checks = [
  ['/map/foreign-resident-issues', '外国人住民と、'],
  ['/map/foreign-ratio', '外国人住民の割合'],
  ['/map', '住みやすさマップ'],
  ['/map/rent', '家賃'],
  ['/ranking/foreign-ratio-high', '外国人'],
  ['/area/saitama/11203', '川口市'],
  ['/sitemap.xml', '/map/foreign-resident-issues'],
];
for (const [url, content] of checks) {
  const response = await fetch(base + url);
  assert.equal(response.status, 200, url);
  const html = await response.text();
  assert.ok(html.includes(content), url + ' expected content');
  if (url === '/map/foreign-resident-issues') {
    assert.ok(html.includes('rel="canonical" href="https://kurashimap.jp/map/foreign-resident-issues"'));
    assert.ok(html.includes('application/ld+json'));
    assert.ok(html.includes('公的データの出典'));
  }
  console.log(`OK ${url}`);
}
const response = await fetch(base + '/foreign-resident-issues/dataset.json');
assert.equal(response.status, 200);
const data = await response.json();
assert.equal(data.education.length, 282);
assert.equal(data.guidance.length, 3482);
console.log(`OK data: ${data.resident.length} resident / ${data.education.length} education / ${data.guidance.length} guidance`);
