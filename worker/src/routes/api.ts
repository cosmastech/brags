import { Hono } from 'hono';
import type { AppEnv } from '../env';
import * as store from '../store';
import { ArchiveInput, BragInput, BragPatch, MergeInput, QueryInput, STATES, StoryInput, StoryPatch } from '../validation';

export const api = new Hono<AppEnv>();

const notFound = (c: { json: (body: unknown, status: number) => Response }) => c.json({ error: 'not found' }, 404);

function clampInt(value: string | undefined, fallback: number, max: number): number {
  const n = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(n, max);
}

api.get('/', (c) =>
  c.json({
    name: 'brags',
    endpoints: [
      'POST /brags',
      'GET /brags?state&since&until&source&project&tag&needs_review&q&limit&offset',
      'GET /brags/:id',
      'PATCH /brags/:id',
      'POST /brags/:id/promote',
      'POST /brags/:id/archive',
      'POST /brags/:id/unarchive',
      'POST /brags/merge',
      'GET /stories?status&dimension',
      'POST /stories',
      'GET /stories/:id',
      'PATCH /stories/:id',
      'POST /query',
      'GET /export',
      'GET /doctor',
    ],
  }),
);

api.post('/brags', async (c) => {
  const parsed = BragInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'invalid record', issues: parsed.error.issues }, 400);
  const result = await store.createBrag(c.env, parsed.data, c.get('actor'));
  return c.json(result, result.created ? 201 : 200);
});

api.get('/brags', async (c) => {
  const q = c.req.query();
  const state = q.state;
  if (state && !(STATES as readonly string[]).includes(state)) {
    return c.json({ error: `state must be one of ${STATES.join(', ')}` }, 400);
  }
  const brags = await store.listBrags(c.env, {
    state,
    since: q.since,
    until: q.until,
    source: q.source,
    project: q.project,
    tag: q.tag,
    needs_review: q.needs_review === 'true',
    q: q.q,
    limit: clampInt(q.limit, 50, 200),
    offset: clampInt(q.offset, 0, 100000),
  });
  return c.json({ brags, count: brags.length });
});

api.get('/brags/:id', async (c) => {
  const brag = await store.getBragFull(c.env, c.req.param('id'));
  return brag ? c.json(brag) : notFound(c);
});

api.patch('/brags/:id', async (c) => {
  const parsed = BragPatch.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'invalid patch', issues: parsed.error.issues }, 400);
  const brag = await store.patchBrag(c.env, c.req.param('id'), parsed.data);
  return brag ? c.json(brag) : notFound(c);
});

api.post('/brags/:id/promote', async (c) => {
  const brag = await store.setBragState(c.env, c.req.param('id'), 'active', 'keep', null, c.get('actor'));
  return brag ? c.json(brag) : notFound(c);
});

api.post('/brags/:id/archive', async (c) => {
  const parsed = ArchiveInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'invalid request', issues: parsed.error.issues }, 400);
  const brag = await store.setBragState(c.env, c.req.param('id'), 'archived', 'drop', parsed.data.reason, c.get('actor'));
  return brag ? c.json(brag) : notFound(c);
});

api.post('/brags/:id/unarchive', async (c) => {
  const brag = await store.setBragState(c.env, c.req.param('id'), 'inbox', 'unarchive', null, c.get('actor'));
  return brag ? c.json(brag) : notFound(c);
});

api.post('/brags/merge', async (c) => {
  const parsed = MergeInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'invalid request', issues: parsed.error.issues }, 400);
  const brag = await store.mergeBrags(c.env, parsed.data.canonical_id, parsed.data.other_ids, parsed.data.reason, c.get('actor'));
  return c.json(brag);
});

api.get('/stories', async (c) => {
  const q = c.req.query();
  const stories = await store.listStories(c.env, { status: q.status, dimension: q.dimension });
  return c.json({ stories, count: stories.length });
});

api.post('/stories', async (c) => {
  const parsed = StoryInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'invalid story', issues: parsed.error.issues }, 400);
  const result = await store.upsertStory(c.env, parsed.data, c.get('actor'));
  return c.json(result, result.created ? 201 : 200);
});

api.get('/stories/:id', async (c) => {
  const story = await store.getStoryFull(c.env, c.req.param('id'));
  return story ? c.json(story) : notFound(c);
});

api.patch('/stories/:id', async (c) => {
  const parsed = StoryPatch.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'invalid patch', issues: parsed.error.issues }, 400);
  const story = await store.patchStory(c.env, c.req.param('id'), parsed.data, c.get('actor'));
  return story ? c.json(story) : notFound(c);
});

api.post('/query', async (c) => {
  const parsed = QueryInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'invalid request', issues: parsed.error.issues }, 400);
  return c.json(await store.runReadonlyQuery(c.env, parsed.data.sql));
});

api.get('/export', async (c) => {
  const dump = await store.exportDump(c.env);
  c.header('Content-Disposition', `attachment; filename="brags-export-${dump.exported_at.slice(0, 10)}.json"`);
  return c.json(dump);
});

api.get('/doctor', async (c) => c.json(await store.doctor(c.env)));
