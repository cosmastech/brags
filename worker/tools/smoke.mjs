#!/usr/bin/env node
/**
 * End-to-end smoke test against a running Worker.
 *
 * Defaults to http://localhost:8787 and refuses remote targets unless
 * ALLOW_REMOTE_SMOKE=1 because it intentionally writes test records.
 */
const BASE = (process.env.BRAG_API_URL ?? 'http://localhost:8787').replace(/\/$/, '');
const TOKEN = process.env.BRAG_TOKEN ?? 'dev-token';
const url = new URL(BASE);
if (!['localhost', '127.0.0.1'].includes(url.hostname) && process.env.ALLOW_REMOTE_SMOKE !== '1') {
  console.error('Refusing to write smoke records to a remote target. Set ALLOW_REMOTE_SMOKE=1 intentionally.');
  process.exit(1);
}

const run = Date.now();
const canonicalId = `smoke-${run}-canonical`;
const otherId = `smoke-${run}-other`;
const storyId = `smoke-${run}-story`;
const auth = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

async function request(method, path, body, extra = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...auth, ...extra.headers },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: extra.redirect ?? 'follow',
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed, text, headers: res.headers };
}

function assert(cond, message) {
  if (!cond) throw new Error(`FAIL: ${message}`);
}

const canonical = {
  id: canonicalId,
  date: '2026-01-01',
  source: 'manual',
  title: 'Smoke canonical',
  summary: 'Used only for local API verification.',
  visibility: 'private',
  public_safe: false,
  needs_review: true,
  tags: ['smoke'],
  evidence: [{ type: 'manual_note', title: 'canonical evidence', visibility: 'private' }],
  behavioral_evidence: [
    {
      signal: 'verification',
      supports: ['ownership'],
      basis: 'Exercised the full API locally.',
      confidence: 'high',
    },
  ],
};
const other = {
  id: otherId,
  date: '2026-01-02',
  source: 'manual',
  title: 'Smoke other',
  summary: 'Merged during local API verification.',
  visibility: 'private',
  public_safe: false,
  evidence: [{ type: 'manual_note', title: 'other evidence', visibility: 'private' }],
};

let r = await request('POST', '/brags', canonical);
assert(r.status === 201 && r.body.created, 'capture creates canonical record');
r = await request('POST', '/brags', other);
assert(r.status === 201 && r.body.created, 'capture creates merge source');
r = await request('POST', `/brags/${canonicalId}/promote`);
assert(r.status === 200 && r.body.state === 'active', 'promote moves inbox -> active');
canonical.title = 'Smoke canonical updated';
r = await request('POST', '/brags', canonical);
assert(r.status === 200 && !r.body.created, 'capture retry is an upsert');
r = await request('GET', `/brags/${canonicalId}`);
assert(r.body.state === 'active' && r.body.title.endsWith('updated'), 'upsert preserves promoted state');
r = await request('POST', '/brags/merge', {
  canonical_id: canonicalId,
  other_ids: [otherId],
  reason: 'local smoke test',
});
assert(r.status === 200 && r.body.evidence.length === 2, 'merge transfers evidence');
r = await request('GET', `/brags/${otherId}`);
assert(r.body.state === 'merged' && r.body.merged_into === canonicalId, 'merge source remains auditable');
r = await request('POST', `/brags/${otherId}/promote`);
assert(r.status === 409, 'illegal merged -> active transition is blocked');
r = await request('POST', `/brags/${canonicalId}/archive`, { reason: 'local smoke test' });
assert(r.body.state === 'archived', 'archive is a soft delete');
r = await request('POST', `/brags/${canonicalId}/unarchive`);
assert(r.body.state === 'inbox', 'archive is reversible');

r = await request('POST', '/stories', {
  id: storyId,
  title: 'Smoke story',
  date: '2026-01-02',
  status: 'draft',
  dimensions: ['ownership'],
  behaviors: ['verification'],
  source_brag_ids: [canonicalId],
  body_md: '## Context\n\n<script>alert(1)</script>\n',
});
assert(r.status === 201 && r.body.created, 'story creates');
r = await request('PATCH', `/stories/${storyId}`, { status: 'ready', dimensions: ['ownership', 'growth'] });
assert(r.body.status === 'ready' && r.body.dimensions.length === 2, 'story patches');
r = await request('GET', `/brags/${canonicalId}`);
assert(r.body.decisions.some((d) => d.decision === 'story' && d.reason === `linked to story ${storyId}`), 'story link is audited');

r = await request('POST', '/query', { sql: 'SELECT state, COUNT(*) AS total FROM brags GROUP BY state' });
assert(r.status === 200 && Array.isArray(r.body.rows), 'read-only SQL runs');
r = await request('POST', '/query', { sql: 'DELETE FROM brags' });
assert(r.status === 400, 'write SQL is rejected');
r = await request('GET', '/export');
assert(r.body.brags.some((b) => b.id === canonicalId) && r.body.stories.some((s) => s.id === storyId), 'export round-trips data');
r = await request('GET', '/doctor');
assert(r.status === 200 && r.body.ok, 'doctor passes');

const login = await fetch(BASE + '/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ password: process.env.BRAG_UI_PASSWORD ?? 'dev-password' }),
  redirect: 'manual',
});
assert(login.status === 302, 'UI login redirects');
const cookie = login.headers.get('set-cookie')?.split(';', 1)[0];
assert(cookie, 'UI login sets a cookie');
const storyPage = await fetch(BASE + `/ui/stories/${storyId}`, { headers: { Cookie: cookie } });
const html = await storyPage.text();
assert(storyPage.status === 200 && html.includes('Smoke story'), 'UI renders story');
assert(!html.includes('<script>alert(1)</script>') && html.includes('&lt;script&gt;'), 'UI escapes story HTML');
assert(storyPage.headers.has('content-security-policy'), 'security headers are present');

console.log('PASS capture + idempotent upsert + state preservation');
console.log('PASS promote + archive + unarchive + transition guards');
console.log('PASS merge + evidence transfer + audit trail');
console.log('PASS story create + patch + source link audit');
console.log('PASS read-only SQL guard + export + doctor');
console.log('PASS UI login + rendering + HTML escaping + security headers');
console.log(`Smoke records use prefix smoke-${run}; reset local D1 after testing if desired.`);
