import type { Env } from './env';
import type { BragIn, BragPatchIn, StoryIn, StoryPatchIn } from './validation';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const now = () => new Date().toISOString();

// ---------------------------------------------------------------------------
// Brags

type DbRow = Record<string, any>;

export function rowToBrag(r: Record<string, unknown>): DbRow {
  return {
    ...r,
    tags: JSON.parse((r.tags as string) ?? '[]'),
    people: JSON.parse((r.people as string) ?? '[]'),
    public_safe: !!r.public_safe,
    needs_review: !!r.needs_review,
  };
}

function rowToBehavioral(r: Record<string, unknown>): DbRow {
  return { ...r, supports: JSON.parse((r.supports as string) ?? '[]') };
}

export interface BragFilters {
  state?: string;
  since?: string;
  until?: string;
  source?: string;
  project?: string;
  tag?: string;
  needs_review?: boolean;
  q?: string;
  limit: number;
  offset: number;
}

function ftsMatch(q: string): string | null {
  const tokens = q.toLowerCase().match(/[a-z0-9]+/g);
  if (!tokens?.length) return null;
  // Quoted prefix terms, ANDed together: "order"* "lookup"*
  return tokens.map((t) => `"${t}"*`).join(' ');
}

export async function listBrags(env: Env, f: BragFilters) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (f.state) {
    where.push('b.state = ?');
    params.push(f.state);
  }
  if (f.since) {
    where.push('b.date >= ?');
    params.push(f.since);
  }
  if (f.until) {
    where.push('b.date <= ?');
    params.push(f.until);
  }
  if (f.source) {
    where.push('b.source = ?');
    params.push(f.source);
  }
  if (f.project) {
    where.push('b.project = ?');
    params.push(f.project);
  }
  if (f.needs_review) where.push('b.needs_review = 1');
  if (f.tag) {
    where.push('EXISTS (SELECT 1 FROM json_each(b.tags) WHERE json_each.value = ?)');
    params.push(f.tag);
  }
  if (f.q) {
    const match = ftsMatch(f.q);
    if (match) {
      where.push('b.id IN (SELECT id FROM brags_fts WHERE brags_fts MATCH ?)');
      params.push(match);
    } else {
      where.push('1 = 0');
    }
  }
  const sql =
    `SELECT b.* FROM brags b ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ` +
    `ORDER BY b.date DESC, b.id LIMIT ? OFFSET ?`;
  params.push(f.limit, f.offset);
  const res = await env.DB.prepare(sql)
    .bind(...params)
    .all();
  return res.results.map(rowToBrag);
}

export async function getBragFull(env: Env, id: string) {
  const row = await env.DB.prepare('SELECT * FROM brags WHERE id = ?').bind(id).first();
  if (!row) return null;
  const [evidence, behavioral, decisions] = await Promise.all([
    env.DB.prepare('SELECT id, type, url, title, visibility, note FROM evidence WHERE brag_id = ? ORDER BY id').bind(id).all(),
    env.DB.prepare('SELECT id, signal, supports, basis, confidence, created_at FROM behavioral_evidence WHERE brag_id = ? ORDER BY id').bind(id).all(),
    env.DB.prepare('SELECT id, decision, reason, actor, created_at FROM review_decisions WHERE brag_id = ? ORDER BY created_at DESC, id DESC').bind(id).all(),
  ]);
  return {
    ...rowToBrag(row),
    evidence: evidence.results,
    behavioral_evidence: behavioral.results.map(rowToBehavioral),
    decisions: decisions.results,
  } as DbRow;
}

export async function createBrag(env: Env, input: BragIn, _actor: string) {
  const existing = await env.DB.prepare('SELECT id FROM brags WHERE id = ?').bind(input.id).first();
  const ts = now();
  const stmts = [
    // Upsert. On re-capture the existing state and created_at are preserved:
    // a re-sent inbox candidate must not demote an already-promoted record.
    env.DB.prepare(
      `INSERT INTO brags (id, date, source, source_url, title, summary, project, role, impact,
                          tags, people, visibility, public_safe, confidence, needs_review, notes,
                          state, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
         date = excluded.date, source = excluded.source, source_url = excluded.source_url,
         title = excluded.title, summary = excluded.summary, project = excluded.project,
         role = excluded.role, impact = excluded.impact, tags = excluded.tags, people = excluded.people,
         visibility = excluded.visibility, public_safe = excluded.public_safe,
         confidence = excluded.confidence, needs_review = excluded.needs_review,
         notes = excluded.notes, updated_at = excluded.updated_at`,
    ).bind(
      input.id,
      input.date,
      input.source,
      input.source_url ?? null,
      input.title,
      input.summary,
      input.project ?? null,
      input.role ?? null,
      input.impact ?? null,
      JSON.stringify(input.tags),
      JSON.stringify(input.people),
      input.visibility,
      input.public_safe ? 1 : 0,
      input.confidence,
      input.needs_review ? 1 : 0,
      input.notes ?? null,
      input.state,
      input.created_at ?? ts,
      input.updated_at ?? ts,
    ),
    // Evidence children are fully replaced on every capture.
    env.DB.prepare('DELETE FROM evidence WHERE brag_id = ?').bind(input.id),
    env.DB.prepare('DELETE FROM behavioral_evidence WHERE brag_id = ?').bind(input.id),
    ...input.evidence.map((e) =>
      env.DB.prepare('INSERT INTO evidence (brag_id, type, url, title, visibility, note) VALUES (?,?,?,?,?,?)').bind(
        input.id,
        e.type,
        e.url ?? null,
        e.title ?? null,
        e.visibility ?? null,
        e.note ?? null,
      ),
    ),
    ...input.behavioral_evidence.map((b) =>
      env.DB.prepare(
        'INSERT INTO behavioral_evidence (brag_id, signal, supports, basis, confidence, created_at) VALUES (?,?,?,?,?,?)',
      ).bind(input.id, b.signal, JSON.stringify(b.supports), b.basis, b.confidence, ts),
    ),
  ];
  await env.DB.batch(stmts);
  return { id: input.id, created: !existing };
}

const PATCH_COLUMNS: Record<string, (v: unknown) => unknown> = {
  date: (v) => v,
  source: (v) => v,
  source_url: (v) => v,
  title: (v) => v,
  summary: (v) => v,
  project: (v) => v,
  role: (v) => v,
  impact: (v) => v,
  notes: (v) => v,
  visibility: (v) => v,
  confidence: (v) => v,
  tags: (v) => JSON.stringify(v),
  people: (v) => JSON.stringify(v),
  public_safe: (v) => (v ? 1 : 0),
  needs_review: (v) => (v ? 1 : 0),
};

export async function patchBrag(env: Env, id: string, patch: BragPatchIn) {
  const existing = await env.DB.prepare('SELECT * FROM brags WHERE id = ?').bind(id).first();
  if (!existing) return null;

  const merged = { ...rowToBrag(existing) } as Record<string, unknown>;
  for (const [k, v] of Object.entries(patch)) if (v !== undefined) merged[k] = v;
  if (merged.visibility === 'public' && !merged.public_safe) {
    throw new ApiError(400, 'visibility=public requires public_safe=true');
  }

  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const convert = PATCH_COLUMNS[key];
    if (!convert) continue;
    sets.push(`${key} = ?`);
    params.push(convert(value));
  }
  if (!sets.length) return getBragFull(env, id);
  sets.push('updated_at = ?');
  params.push(now(), id);
  await env.DB.prepare(`UPDATE brags SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...params)
    .run();
  return getBragFull(env, id);
}

export async function setBragState(
  env: Env,
  id: string,
  target: 'inbox' | 'active' | 'archived',
  decision: string,
  reason: string | null,
  actor: string,
) {
  const existing = await env.DB.prepare('SELECT id, state FROM brags WHERE id = ?').bind(id).first();
  if (!existing) return null;
  const current = String(existing.state);
  const allowed =
    target === 'active'
      ? ['inbox', 'active']
      : target === 'archived'
        ? ['inbox', 'active', 'archived']
        : ['archived', 'inbox'];
  if (!allowed.includes(current)) {
    throw new ApiError(409, `cannot move a ${current} record to ${target}`);
  }
  const ts = now();
  await env.DB.batch([
    env.DB.prepare('UPDATE brags SET state = ?, archive_reason = ?, updated_at = ? WHERE id = ?').bind(
      target,
      target === 'archived' ? reason : null,
      ts,
      id,
    ),
    env.DB.prepare('INSERT INTO review_decisions (brag_id, decision, reason, actor, created_at) VALUES (?,?,?,?,?)').bind(
      id,
      decision,
      reason,
      actor,
      ts,
    ),
  ]);
  return getBragFull(env, id);
}

export async function mergeBrags(env: Env, canonicalId: string, otherIds: string[], reason: string | undefined, actor: string) {
  const canonical = await env.DB.prepare('SELECT id, state FROM brags WHERE id = ?').bind(canonicalId).first();
  if (!canonical) throw new ApiError(404, `canonical record ${canonicalId} not found`);
  if (!['inbox', 'active'].includes(String(canonical.state))) {
    throw new ApiError(409, `a ${canonical.state} record cannot be the merge target`);
  }
  const uniqueOthers = [...new Set(otherIds)];
  for (const other of uniqueOthers) {
    if (other === canonicalId) throw new ApiError(400, 'a record cannot be merged into itself');
    const row = await env.DB.prepare('SELECT id, state FROM brags WHERE id = ?').bind(other).first();
    if (!row) throw new ApiError(404, `record ${other} not found`);
    if (row.state === 'merged') throw new ApiError(400, `record ${other} is already merged into ${row.id}`);
  }

  const ts = now();
  const stmts: D1PreparedStatement[] = [];
  for (const other of uniqueOthers) {
    stmts.push(
      env.DB.prepare(
        'INSERT INTO evidence (brag_id, type, url, title, visibility, note) SELECT ?, type, url, title, visibility, note FROM evidence WHERE brag_id = ?',
      ).bind(canonicalId, other),
      env.DB.prepare(
        'INSERT INTO behavioral_evidence (brag_id, signal, supports, basis, confidence, created_at) SELECT ?, signal, supports, basis, confidence, created_at FROM behavioral_evidence WHERE brag_id = ?',
      ).bind(canonicalId, other),
      env.DB.prepare("UPDATE brags SET state = 'merged', merged_into = ?, updated_at = ? WHERE id = ?").bind(canonicalId, ts, other),
      env.DB.prepare('INSERT INTO review_decisions (brag_id, decision, reason, actor, created_at) VALUES (?,?,?,?,?)').bind(
        other,
        'merge',
        reason ?? `merged into ${canonicalId}`,
        actor,
        ts,
      ),
    );
  }
  stmts.push(
    env.DB.prepare('INSERT INTO review_decisions (brag_id, decision, reason, actor, created_at) VALUES (?,?,?,?,?)').bind(
      canonicalId,
      'merge',
      reason ?? `absorbed ${uniqueOthers.join(', ')}`,
      actor,
      ts,
    ),
  );
  await env.DB.batch(stmts);
  return getBragFull(env, canonicalId);
}

// ---------------------------------------------------------------------------
// Stories

export async function listStories(env: Env, f: { status?: string; dimension?: string }) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (f.status) {
    where.push('s.status = ?');
    params.push(f.status);
  }
  if (f.dimension) {
    where.push('EXISTS (SELECT 1 FROM story_dimensions sd WHERE sd.story_id = s.id AND sd.dimension = ?)');
    params.push(f.dimension);
  }
  const res = await env.DB.prepare(
    `SELECT s.id, s.title, s.date, s.status, s.behaviors, s.last_reviewed_at, s.created_at, s.updated_at,
            (SELECT json_group_array(sd.dimension) FROM story_dimensions sd WHERE sd.story_id = s.id) AS dimensions,
            (SELECT COUNT(*) FROM story_brags sb WHERE sb.story_id = s.id) AS source_brag_count
       FROM stories s ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY s.date DESC, s.id`,
  )
    .bind(...params)
    .all();
  return res.results.map((raw): DbRow => {
    const r = raw as DbRow;
    return {
      ...r,
      behaviors: JSON.parse((r.behaviors as string) ?? '[]'),
      dimensions: JSON.parse((r.dimensions as string) ?? '[]'),
    };
  });
}

export async function getStoryFull(env: Env, id: string) {
  const raw = await env.DB.prepare('SELECT * FROM stories WHERE id = ?').bind(id).first();
  if (!raw) return null;
  const row = raw as DbRow;
  const [dims, links] = await Promise.all([
    env.DB.prepare('SELECT dimension FROM story_dimensions WHERE story_id = ? ORDER BY dimension').bind(id).all(),
    env.DB.prepare(
      'SELECT b.id, b.title, b.date, b.state FROM story_brags sb JOIN brags b ON b.id = sb.brag_id WHERE sb.story_id = ? ORDER BY b.date',
    ).bind(id).all(),
  ]);
  return {
    ...row,
    behaviors: JSON.parse((row.behaviors as string) ?? '[]'),
    dimensions: dims.results.map((d) => d.dimension),
    source_brags: links.results,
  } as DbRow;
}

async function assertBragsExist(env: Env, ids: string[]) {
  if (!ids.length) return;
  const placeholders = ids.map(() => '?').join(',');
  const found = await env.DB.prepare(`SELECT COUNT(*) AS c FROM brags WHERE id IN (${placeholders})`)
    .bind(...ids)
    .first();
  if (Number(found?.c ?? 0) !== ids.length) throw new ApiError(400, 'some source_brag_ids do not exist');
}

export async function upsertStory(env: Env, input: StoryIn, actor: string) {
  await assertBragsExist(env, input.source_brag_ids);
  const [existing, existingLinksResult] = await Promise.all([
    env.DB.prepare('SELECT id FROM stories WHERE id = ?').bind(input.id).first(),
    env.DB.prepare('SELECT brag_id FROM story_brags WHERE story_id = ?').bind(input.id).all(),
  ]);
  const existingLinks = new Set(existingLinksResult.results.map((r) => String(r.brag_id)));
  const ts = now();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO stories (id, title, date, status, behaviors, body_md, last_reviewed_at, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title, date = excluded.date, status = excluded.status,
         behaviors = excluded.behaviors, body_md = excluded.body_md,
         last_reviewed_at = excluded.last_reviewed_at, updated_at = excluded.updated_at`,
    ).bind(
      input.id,
      input.title,
      input.date,
      input.status,
      JSON.stringify(input.behaviors),
      input.body_md,
      input.last_reviewed_at ?? null,
      input.created_at ?? ts,
      input.updated_at ?? ts,
    ),
    env.DB.prepare('DELETE FROM story_brags WHERE story_id = ?').bind(input.id),
    env.DB.prepare('DELETE FROM story_dimensions WHERE story_id = ?').bind(input.id),
    ...input.source_brag_ids.map((b) => env.DB.prepare('INSERT INTO story_brags (story_id, brag_id) VALUES (?,?)').bind(input.id, b)),
    ...input.dimensions.map((d) => env.DB.prepare('INSERT INTO story_dimensions (story_id, dimension) VALUES (?,?)').bind(input.id, d)),
    ...input.source_brag_ids
      .filter((bragId) => !existingLinks.has(bragId))
      .map((bragId) =>
        env.DB.prepare('INSERT INTO review_decisions (brag_id, decision, reason, actor, created_at) VALUES (?,?,?,?,?)').bind(
          bragId,
          'story',
          `linked to story ${input.id}`,
          actor,
          ts,
        ),
      ),
  ]);
  return { id: input.id, created: !existing };
}

export async function patchStory(env: Env, id: string, patch: StoryPatchIn, actor: string) {
  const existing = await env.DB.prepare('SELECT id FROM stories WHERE id = ?').bind(id).first();
  if (!existing) return null;
  if (patch.source_brag_ids) await assertBragsExist(env, patch.source_brag_ids);
  const priorLinks = patch.source_brag_ids
    ? new Set((await env.DB.prepare('SELECT brag_id FROM story_brags WHERE story_id = ?').bind(id).all()).results.map((r) => String(r.brag_id)))
    : new Set<string>();

  const ts = now();
  const stmts: D1PreparedStatement[] = [];
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const key of ['title', 'date', 'status', 'body_md', 'last_reviewed_at'] as const) {
    const value = patch[key];
    if (value === undefined) continue;
    sets.push(`${key} = ?`);
    params.push(value);
  }
  if (patch.behaviors !== undefined) {
    sets.push('behaviors = ?');
    params.push(JSON.stringify(patch.behaviors));
  }
  sets.push('updated_at = ?');
  params.push(ts, id);
  stmts.push(env.DB.prepare(`UPDATE stories SET ${sets.join(', ')} WHERE id = ?`).bind(...params));

  if (patch.source_brag_ids !== undefined) {
    stmts.push(env.DB.prepare('DELETE FROM story_brags WHERE story_id = ?').bind(id));
    stmts.push(...patch.source_brag_ids.map((b) => env.DB.prepare('INSERT INTO story_brags (story_id, brag_id) VALUES (?,?)').bind(id, b)));
    stmts.push(
      ...patch.source_brag_ids
        .filter((bragId) => !priorLinks.has(bragId))
        .map((bragId) =>
          env.DB.prepare('INSERT INTO review_decisions (brag_id, decision, reason, actor, created_at) VALUES (?,?,?,?,?)').bind(
            bragId,
            'story',
            `linked to story ${id}`,
            actor,
            ts,
          ),
        ),
    );
  }
  if (patch.dimensions !== undefined) {
    stmts.push(env.DB.prepare('DELETE FROM story_dimensions WHERE story_id = ?').bind(id));
    stmts.push(...patch.dimensions.map((d) => env.DB.prepare('INSERT INTO story_dimensions (story_id, dimension) VALUES (?,?)').bind(id, d)));
  }
  await env.DB.batch(stmts);
  return getStoryFull(env, id);
}

// ---------------------------------------------------------------------------
// Read-only SQL escape hatch

const WRITE_KEYWORDS = /\b(insert|update|delete|drop|alter|create|replace|pragma|attach|detach|vacuum|reindex|truncate)\b/i;

export async function runReadonlyQuery(env: Env, sql: string) {
  const cleaned = sql.trim().replace(/;+\s*$/, '');
  if (cleaned.includes(';')) throw new ApiError(400, 'single statement only');
  if (!/^(select|with)\b/i.test(cleaned)) throw new ApiError(400, 'SELECT statements only');
  if (WRITE_KEYWORDS.test(cleaned)) throw new ApiError(400, 'read-only: write keywords are not allowed');
  const res = await env.DB.prepare(`SELECT * FROM (${cleaned}) LIMIT 500`).all();
  return { rows: res.results, truncated: res.results.length === 500 };
}

// ---------------------------------------------------------------------------
// Decisions, export, doctor

export async function listDecisions(env: Env, limit = 100) {
  const res = await env.DB.prepare(
    `SELECT d.id, d.brag_id, d.decision, d.reason, d.actor, d.created_at, b.title AS brag_title
       FROM review_decisions d LEFT JOIN brags b ON b.id = d.brag_id
      ORDER BY d.created_at DESC, d.id DESC LIMIT ?`,
  )
    .bind(limit)
    .all();
  return res.results;
}

export async function stateCounts(env: Env) {
  const res = await env.DB.prepare('SELECT state, COUNT(*) AS count FROM brags GROUP BY state').all();
  const counts: Record<string, number> = { inbox: 0, active: 0, archived: 0, merged: 0 };
  for (const row of res.results) counts[row.state as string] = Number(row.count);
  const stories = await env.DB.prepare('SELECT COUNT(*) AS c FROM stories').first();
  return { brags: counts, stories: Number(stories?.c ?? 0) };
}

export async function exportDump(env: Env) {
  const [brags, evidence, behavioral, decisions, stories, storyBrags, storyDims] = await Promise.all([
    env.DB.prepare('SELECT * FROM brags ORDER BY date, id').all(),
    env.DB.prepare('SELECT id, brag_id, type, url, title, visibility, note FROM evidence ORDER BY brag_id, id').all(),
    env.DB.prepare('SELECT id, brag_id, signal, supports, basis, confidence, created_at FROM behavioral_evidence ORDER BY brag_id, id').all(),
    env.DB.prepare('SELECT id, brag_id, decision, reason, actor, created_at FROM review_decisions ORDER BY brag_id, id').all(),
    env.DB.prepare('SELECT * FROM stories ORDER BY date, id').all(),
    env.DB.prepare('SELECT story_id, brag_id FROM story_brags ORDER BY story_id, brag_id').all(),
    env.DB.prepare('SELECT story_id, dimension FROM story_dimensions ORDER BY story_id, dimension').all(),
  ]);
  return {
    version: 1,
    exported_at: now(),
    brags: brags.results.map((r) => {
      const brag = rowToBrag(r);
      return {
        ...brag,
        evidence: evidence.results.filter((e) => e.brag_id === brag.id).map(({ brag_id: _, ...rest }) => rest),
        behavioral_evidence: behavioral.results
          .filter((b) => b.brag_id === brag.id)
          .map(({ brag_id: _, ...rest }) => rowToBehavioral(rest)),
        decisions: decisions.results.filter((d) => d.brag_id === brag.id).map(({ brag_id: _, ...rest }) => rest),
      };
    }),
    stories: stories.results.map((s) => ({
      ...s,
      behaviors: JSON.parse((s.behaviors as string) ?? '[]'),
      source_brag_ids: storyBrags.results.filter((sb) => sb.story_id === s.id).map((sb) => sb.brag_id),
      dimensions: storyDims.results.filter((sd) => sd.story_id === s.id).map((sd) => sd.dimension),
    })),
  };
}

async function count(env: Env, sql: string): Promise<number> {
  const row = await env.DB.prepare(sql).first();
  return Number(row?.c ?? 0);
}

export async function doctor(env: Env) {
  const byState = await stateCounts(env);
  const [evidenceC, behavioralC, decisionsC, storiesByStatus] = await Promise.all([
    count(env, 'SELECT COUNT(*) AS c FROM evidence'),
    count(env, 'SELECT COUNT(*) AS c FROM behavioral_evidence'),
    count(env, 'SELECT COUNT(*) AS c FROM review_decisions'),
    env.DB.prepare('SELECT status, COUNT(*) AS count FROM stories GROUP BY status').all(),
  ]);
  const issues = {
    orphan_evidence: await count(env, 'SELECT COUNT(*) AS c FROM evidence e LEFT JOIN brags b ON b.id = e.brag_id WHERE b.id IS NULL'),
    orphan_behavioral: await count(
      env,
      'SELECT COUNT(*) AS c FROM behavioral_evidence be LEFT JOIN brags b ON b.id = be.brag_id WHERE b.id IS NULL',
    ),
    story_links_to_missing_brags: await count(
      env,
      'SELECT COUNT(*) AS c FROM story_brags sb LEFT JOIN brags b ON b.id = sb.brag_id WHERE b.id IS NULL',
    ),
    merged_without_target: await count(
      env,
      "SELECT COUNT(*) AS c FROM brags m LEFT JOIN brags t ON t.id = m.merged_into WHERE m.state = 'merged' AND (m.merged_into IS NULL OR t.id IS NULL)",
    ),
    fts_out_of_sync: Math.abs(
      (await count(env, 'SELECT COUNT(*) AS c FROM brags_fts')) - (await count(env, 'SELECT COUNT(*) AS c FROM brags')),
    ),
  };
  const lastDecision = await env.DB.prepare('SELECT MAX(created_at) AS latest FROM review_decisions').first();
  const total = Object.values(byState.brags).reduce((a, b) => a + b, 0);
  return {
    ok: Object.values(issues).every((n) => n === 0),
    brags: { total, by_state: byState.brags },
    stories: {
      total: byState.stories,
      by_status: Object.fromEntries(storiesByStatus.results.map((r) => [r.status, Number(r.count)])),
    },
    evidence: evidenceC,
    behavioral_evidence: behavioralC,
    review_decisions: decisionsC,
    issues,
    last_decision_at: lastDecision?.latest ?? null,
  };
}
