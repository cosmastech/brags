import { Hono } from 'hono';
import { marked } from 'marked';
import type { AppEnv } from '../env';
import * as store from '../store';
import { DIMENSIONS, STATES } from '../validation';
import { badges, esc, escapeRawHtml, page, stateBadge, type NavCounts } from '../ui/render';

export const ui = new Hono<AppEnv>();

type FormBody = Record<string, string | string[]>;

function flash(c: { req: { query: (k: string) => string | undefined } }) {
  return { msg: c.req.query('msg'), error: c.req.query('error') };
}

async function counts(env: AppEnv['Bindings']): Promise<NavCounts> {
  return store.stateCounts(env);
}

function back(id: string, params: Record<string, string>) {
  return `/ui/brags/${encodeURIComponent(id)}?${new URLSearchParams(params).toString()}`;
}

function str(body: FormBody, key: string): string {
  const v = body[key];
  return typeof v === 'string' ? v.trim() : '';
}

function strOrNull(body: FormBody, key: string): string | null {
  return str(body, key) || null;
}

function list(strOrArr: string | string[] | undefined): string[] {
  if (!strOrArr) return [];
  const raw = Array.isArray(strOrArr) ? strOrArr.join(',') : strOrArr;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const checked = (cond: boolean) => (cond ? ' checked' : '');
const selected = (cond: boolean) => (cond ? ' selected' : '');

// ---------------------------------------------------------------------------
// Brag list (inbox / active / archived / merged)

ui.get('/', async (c) => {
  const q = c.req.query();
  const state = (STATES as readonly string[]).includes(q.state ?? '') ? q.state! : 'inbox';
  const filters = {
    state,
    q: q.q || undefined,
    project: q.project || undefined,
    source: q.source || undefined,
    since: q.since || undefined,
    until: q.until || undefined,
    tag: q.tag || undefined,
    needs_review: q.needs_review === 'true',
    limit: 200,
    offset: 0,
  };
  const [brags, nav] = await Promise.all([store.listBrags(c.env, filters), counts(c.env)]);

  const rows = brags
    .map(
      (b) => `<tr>
        <td class="muted">${esc(b.date)}</td>
        <td><a href="/ui/brags/${encodeURIComponent(b.id as string)}">${esc(b.title)}</a>${b.needs_review ? ' <span class="badge review">needs review</span>' : ''}</td>
        <td>${esc(b.project ?? '')}</td>
        <td class="muted">${esc(b.source)}</td>
        <td>${badges(b.tags as unknown[])}</td>
      </tr>`,
    )
    .join('');

  const table = brags.length
    ? `<table><thead><tr><th>Date</th><th>Title</th><th>Project</th><th>Source</th><th>Tags</th></tr></thead><tbody>${rows}</tbody></table>`
    : `<div class="empty">No ${esc(state)} records. ${state === 'inbox' ? 'The queue is clear.' : ''}</div>`;

  return c.html(
    page({
      title: `${state} · brags`,
      counts: nav,
      flash: flash(c),
      content: `
        <h1>${esc(state[0].toUpperCase() + state.slice(1))} <span class="muted">(${brags.length})</span></h1>
        <div class="card">
          <form method="get" action="/ui" class="filters">
            <input type="hidden" name="state" value="${esc(state)}">
            <div><label>Search</label><input type="text" name="q" value="${esc(q.q ?? '')}" placeholder="tenancy, rollout, ..."></div>
            <div><label>Project</label><input type="text" name="project" value="${esc(q.project ?? '')}"></div>
            <div><label>Source</label><input type="text" name="source" value="${esc(q.source ?? '')}" placeholder="gitlab, notion, ..."></div>
            <div><label>Tag</label><input type="text" name="tag" value="${esc(q.tag ?? '')}"></div>
            <div><label>Since</label><input type="date" name="since" value="${esc(q.since ?? '')}"></div>
            <div><label>Until</label><input type="date" name="until" value="${esc(q.until ?? '')}"></div>
            <div><label>&nbsp;</label><label style="display:flex;gap:0.35rem;align-items:center;margin:0;"><input type="checkbox" name="needs_review" value="true"${checked(q.needs_review === 'true')}> needs review</label></div>
            <div><button class="btn" type="submit">Filter</button></div>
          </form>
        </div>
        ${table}`,
    }),
  );
});

// ---------------------------------------------------------------------------
// Brag detail + dispositions

function field(labelText: string, name: string, value: unknown, opts: { textarea?: boolean; rows?: number } = {}): string {
  const v = esc(value ?? '');
  const input = opts.textarea
    ? `<textarea name="${name}" rows="${opts.rows ?? 3}">${v}</textarea>`
    : `<input type="text" name="${name}" value="${v}">`;
  return `<label>${labelText}</label>${input}`;
}

ui.get('/brags/:id', async (c) => {
  const id = c.req.param('id');
  const [brag, nav] = await Promise.all([store.getBragFull(c.env, id), counts(c.env)]);
  if (!brag) return c.html(page({ title: 'not found', counts: nav, content: '<div class="empty">Record not found.</div>' }), 404);

  const evidenceRows = (brag.evidence as Record<string, unknown>[])
    .map(
      (e) => `<tr><td>${esc(e.type)}</td><td>${e.url ? `<a href="${esc(e.url)}">${esc(e.title ?? e.url)}</a>` : esc(e.title ?? '')}</td><td class="muted">${esc(e.visibility ?? '')}</td><td class="muted">${esc(e.note ?? '')}</td></tr>`,
    )
    .join('');
  const behavioralItems = (brag.behavioral_evidence as Record<string, unknown>[])
    .map(
      (b) => `<li><strong>${esc(b.signal)}</strong> ${badges(b.supports as unknown[])} <span class="muted">(${esc(b.confidence)})</span><br>${esc(b.basis)}</li>`,
    )
    .join('');
  const decisionRows = (brag.decisions as Record<string, unknown>[])
    .map(
      (d) => `<tr><td class="muted">${esc(String(d.created_at).slice(0, 16).replace('T', ' '))}</td><td>${esc(d.decision)}</td><td>${esc(d.actor)}</td><td>${esc(d.reason ?? '')}</td></tr>`,
    )
    .join('');

  const actions: string[] = [];
  if (brag.state === 'inbox') {
    actions.push(`
      <form method="post" action="/ui/brags/${encodeURIComponent(id)}/keep"><button class="btn primary" type="submit">Keep (promote)</button></form>
      <form method="post" action="/ui/brags/${encodeURIComponent(id)}/drop"><input type="text" name="reason" placeholder="why drop?" required><button class="btn danger" type="submit">Drop</button></form>
      <form method="post" action="/ui/brags/${encodeURIComponent(id)}/merge"><input type="text" name="other_ids" placeholder="ids to merge in, comma separated" required><button class="btn" type="submit">Merge into this</button></form>`);
  } else if (brag.state === 'active') {
    actions.push(`
      <form method="post" action="/ui/brags/${encodeURIComponent(id)}/drop"><input type="text" name="reason" placeholder="why drop?" required><button class="btn danger" type="submit">Drop</button></form>`);
  } else if (brag.state === 'archived') {
    actions.push(`
      <form method="post" action="/ui/brags/${encodeURIComponent(id)}/unarchive"><button class="btn" type="submit">Unarchive (back to inbox)</button></form>`);
  }

  const editForm = `
    <details><summary>Edit record</summary>
      <form method="post" action="/ui/brags/${encodeURIComponent(id)}/edit">
        ${field('Title', 'title', brag.title)}
        <div class="filters">
          <div>${field('Date', 'date', brag.date)}</div>
          <div>${field('Source', 'source', brag.source)}</div>
          <div>${field('Project', 'project', brag.project)}</div>
          <div><label>Visibility</label><select name="visibility">
            ${['private', 'work_internal', 'public'].map((v) => `<option value="${v}"${selected(brag.visibility === v)}>${v}</option>`).join('')}
          </select></div>
          <div><label>Confidence</label><select name="confidence">
            ${['low', 'medium', 'high'].map((v) => `<option value="${v}"${selected(brag.confidence === v)}>${v}</option>`).join('')}
          </select></div>
          <div>${field('Tags (comma separated)', 'tags', (brag.tags as string[]).join(', '))}</div>
        </div>
        ${field('Summary', 'summary', brag.summary, { textarea: true, rows: 4 })}
        ${field('Role', 'role', brag.role, { textarea: true, rows: 2 })}
        ${field('Impact', 'impact', brag.impact, { textarea: true, rows: 2 })}
        ${field('Notes (private)', 'notes', brag.notes, { textarea: true, rows: 2 })}
        <div class="checks">
          <label><input type="checkbox" name="public_safe"${checked(!!brag.public_safe)}> public safe</label>
          <label><input type="checkbox" name="needs_review"${checked(!!brag.needs_review)}> needs review</label>
        </div>
        <div style="margin-top: 0.75rem;"><button class="btn primary" type="submit">Save</button></div>
      </form>
    </details>`;

  return c.html(
    page({
      title: brag.title as string,
      counts: nav,
      flash: flash(c),
      content: `
        <h1>${esc(brag.title)} ${stateBadge(brag.state)}</h1>
        ${brag.merged_into ? `<div class="card">Merged into <a href="/ui/brags/${encodeURIComponent(brag.merged_into as string)}">${esc(brag.merged_into)}</a></div>` : ''}
        ${brag.archive_reason ? `<div class="card"><strong>Drop reason:</strong> ${esc(brag.archive_reason)}</div>` : ''}
        <div class="card"><dl class="meta">
          <div><dt>Date</dt><dd>${esc(brag.date)}</dd></div>
          <div><dt>Source</dt><dd>${esc(brag.source)}${brag.source_url ? ` · <a href="${esc(brag.source_url)}">link</a>` : ''}</dd></div>
          <div><dt>Project</dt><dd>${esc(brag.project ?? '—')}</dd></div>
          <div><dt>Visibility</dt><dd>${esc(brag.visibility)}${brag.public_safe ? ' · public safe' : ''}</dd></div>
          <div><dt>Confidence</dt><dd>${esc(brag.confidence)}${brag.needs_review ? ' · needs review' : ''}</dd></div>
          <div><dt>Updated</dt><dd class="muted">${esc(String(brag.updated_at).slice(0, 16).replace('T', ' '))}</dd></div>
        </dl>
        <div style="margin-top: 0.75rem;">${badges(brag.tags as unknown[])}</div></div>

        <div class="card">
          <p>${esc(brag.summary)}</p>
          ${brag.role ? `<p><strong>Role:</strong> ${esc(brag.role)}</p>` : ''}
          ${brag.impact ? `<p><strong>Impact:</strong> ${esc(brag.impact)}</p>` : ''}
          ${brag.notes ? `<p class="muted"><strong>Notes:</strong> ${esc(brag.notes)}</p>` : ''}
        </div>

        <div class="card actions">${actions.join('')}</div>
        ${editForm}

        <h2>Evidence (${(brag.evidence as unknown[]).length})</h2>
        ${evidenceRows ? `<table><thead><tr><th>Type</th><th>Source</th><th>Visibility</th><th>Note</th></tr></thead><tbody>${evidenceRows}</tbody></table>` : '<p class="muted">None.</p>'}

        <h2>Behavioral evidence (${(brag.behavioral_evidence as unknown[]).length})</h2>
        ${behavioralItems ? `<ul>${behavioralItems}</ul>` : '<p class="muted">None.</p>'}

        <h2>Decision history</h2>
        ${decisionRows ? `<table><thead><tr><th>When</th><th>Decision</th><th>Actor</th><th>Reason</th></tr></thead><tbody>${decisionRows}</tbody></table>` : '<p class="muted">No decisions yet.</p>'}`,
    }),
  );
});

ui.post('/brags/:id/edit', async (c) => {
  const id = c.req.param('id');
  const body = (await c.req.parseBody()) as FormBody;
  try {
    const brag = await store.patchBrag(c.env, id, {
      title: str(body, 'title') || undefined,
      date: str(body, 'date') || undefined,
      source: str(body, 'source') || undefined,
      project: strOrNull(body, 'project'),
      summary: str(body, 'summary') || undefined,
      role: strOrNull(body, 'role'),
      impact: strOrNull(body, 'impact'),
      notes: strOrNull(body, 'notes'),
      tags: list(body.tags),
      visibility: (str(body, 'visibility') || undefined) as 'private' | 'work_internal' | 'public' | undefined,
      confidence: (str(body, 'confidence') || undefined) as 'low' | 'medium' | 'high' | undefined,
      public_safe: body.public_safe === 'on',
      needs_review: body.needs_review === 'on',
    });
    if (!brag) return c.redirect(`/ui?error=${encodeURIComponent('record not found')}`);
    return c.redirect(back(id, { msg: 'Saved.' }));
  } catch (e) {
    return c.redirect(back(id, { error: e instanceof Error ? e.message : 'save failed' }));
  }
});

ui.post('/brags/:id/keep', async (c) => {
  const id = c.req.param('id');
  await store.setBragState(c.env, id, 'active', 'keep', null, c.get('actor'));
  return c.redirect(back(id, { msg: 'Promoted to active.' }));
});

ui.post('/brags/:id/drop', async (c) => {
  const id = c.req.param('id');
  const body = (await c.req.parseBody()) as FormBody;
  await store.setBragState(c.env, id, 'archived', 'drop', str(body, 'reason') || 'dropped in UI', c.get('actor'));
  return c.redirect('/ui?msg=' + encodeURIComponent(`Dropped ${id}.`));
});

ui.post('/brags/:id/unarchive', async (c) => {
  const id = c.req.param('id');
  await store.setBragState(c.env, id, 'inbox', 'unarchive', null, c.get('actor'));
  return c.redirect(back(id, { msg: 'Back in the inbox.' }));
});

ui.post('/brags/:id/merge', async (c) => {
  const id = c.req.param('id');
  const body = (await c.req.parseBody()) as FormBody;
  const others = list(body.other_ids);
  try {
    await store.mergeBrags(c.env, id, others, str(body, 'reason') || undefined, c.get('actor'));
    return c.redirect(back(id, { msg: `Merged ${others.join(', ')} into this record.` }));
  } catch (e) {
    return c.redirect(back(id, { error: e instanceof Error ? e.message : 'merge failed' }));
  }
});

// ---------------------------------------------------------------------------
// Stories

ui.get('/stories', async (c) => {
  const q = c.req.query();
  const [stories, nav] = await Promise.all([store.listStories(c.env, { status: q.status || undefined }), counts(c.env)]);
  const rows = stories
    .map(
      (s) => `<tr>
        <td class="muted">${esc(s.date)}</td>
        <td><a href="/ui/stories/${encodeURIComponent(s.id as string)}">${esc(s.title)}</a></td>
        <td><span class="badge ${esc(s.status)}">${esc(s.status)}</span></td>
        <td>${badges(s.dimensions as unknown[])}</td>
        <td class="muted">${esc(s.source_brag_count)}</td>
      </tr>`,
    )
    .join('');
  return c.html(
    page({
      title: 'stories',
      counts: nav,
      flash: flash(c),
      content: `
        <h1>Stories <span class="muted">(${stories.length})</span></h1>
        ${stories.length ? `<table><thead><tr><th>Date</th><th>Title</th><th>Status</th><th>Dimensions</th><th>Sources</th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="empty">No stories yet.</div>'}`,
    }),
  );
});

ui.get('/stories/:id', async (c) => {
  const id = c.req.param('id');
  const [story, nav] = await Promise.all([store.getStoryFull(c.env, id), counts(c.env)]);
  if (!story) return c.html(page({ title: 'not found', counts: nav, content: '<div class="empty">Story not found.</div>' }), 404);

  const rendered = marked.parse(escapeRawHtml(story.body_md), { async: false }) as string;
  const dims = new Set(story.dimensions as string[]);
  const sources = (story.source_brags as Record<string, unknown>[])
    .map((b) => `<li><a href="/ui/brags/${encodeURIComponent(b.id as string)}">${esc(b.title)}</a> <span class="muted">${esc(b.date)} · ${esc(b.state)}</span></li>`)
    .join('');

  return c.html(
    page({
      title: story.title as string,
      counts: nav,
      flash: flash(c),
      content: `
        <h1>${esc(story.title)} <span class="badge ${esc(story.status)}">${esc(story.status)}</span></h1>
        <div class="card"><dl class="meta">
          <div><dt>Date</dt><dd>${esc(story.date)}</dd></div>
          <div><dt>Dimensions</dt><dd>${badges(story.dimensions as unknown[]) || '—'}</dd></div>
          <div><dt>Behaviors</dt><dd>${badges(story.behaviors as unknown[]) || '—'}</dd></div>
          <div><dt>Last reviewed</dt><dd>${esc(story.last_reviewed_at ?? '—')}</dd></div>
        </dl></div>
        <div class="card md">${rendered}</div>
        <h2>Source records</h2>
        ${sources ? `<ul>${sources}</ul>` : '<p class="muted">None linked.</p>'}

        <details><summary>Edit story</summary>
          <form method="post" action="/ui/stories/${encodeURIComponent(id)}/edit">
            ${field('Title', 'title', story.title)}
            <div class="filters">
              <div>${field('Date', 'date', story.date)}</div>
              <div><label>Status</label><select name="status">
                <option value="draft"${selected(story.status === 'draft')}>draft</option>
                <option value="ready"${selected(story.status === 'ready')}>ready</option>
              </select></div>
              <div>${field('Last reviewed at', 'last_reviewed_at', story.last_reviewed_at)}</div>
              <div>${field('Behaviors (comma separated)', 'behaviors', (story.behaviors as string[]).join(', '))}</div>
              <div>${field('Source brag ids (comma separated)', 'source_brag_ids', (story.source_brags as Record<string, unknown>[]).map((b) => b.id).join(', '))}</div>
            </div>
            <label>Dimensions</label>
            <div class="checks">
              ${DIMENSIONS.map((d) => `<label><input type="checkbox" name="dimensions" value="${d}"${checked(dims.has(d))}> ${d}</label>`).join('')}
            </div>
            ${field('Body (markdown)', 'body_md', story.body_md, { textarea: true, rows: 24 })}
            <div style="margin-top: 0.75rem;"><button class="btn primary" type="submit">Save</button></div>
          </form>
        </details>`,
    }),
  );
});

ui.post('/stories/:id/edit', async (c) => {
  const id = c.req.param('id');
  const body = (await c.req.parseBody()) as FormBody;
  const dimValues = body.dimensions;
  try {
    const story = await store.patchStory(c.env, id, {
      title: str(body, 'title') || undefined,
      date: str(body, 'date') || undefined,
      status: (str(body, 'status') || undefined) as 'draft' | 'ready' | undefined,
      last_reviewed_at: str(body, 'last_reviewed_at') || undefined,
      behaviors: list(body.behaviors),
      source_brag_ids: list(body.source_brag_ids),
      dimensions: (Array.isArray(dimValues) ? dimValues : dimValues ? [dimValues] : []) as (typeof DIMENSIONS)[number][],
      body_md: typeof body.body_md === 'string' ? body.body_md : undefined,
    }, c.get('actor'));
    if (!story) return c.redirect(`/ui/stories?error=${encodeURIComponent('story not found')}`);
    return c.redirect(`/ui/stories/${encodeURIComponent(id)}?msg=${encodeURIComponent('Saved.')}`);
  } catch (e) {
    return c.redirect(`/ui/stories/${encodeURIComponent(id)}?error=${encodeURIComponent(e instanceof Error ? e.message : 'save failed')}`);
  }
});

// ---------------------------------------------------------------------------
// Activity

ui.get('/activity', async (c) => {
  const [decisions, nav] = await Promise.all([store.listDecisions(c.env, 200), counts(c.env)]);
  const rows = decisions
    .map(
      (d) => `<tr>
        <td class="muted">${esc(String(d.created_at).slice(0, 16).replace('T', ' '))}</td>
        <td>${esc(d.decision)}</td>
        <td><a href="/ui/brags/${encodeURIComponent(d.brag_id as string)}">${esc(d.brag_title ?? d.brag_id)}</a></td>
        <td>${esc(d.actor)}</td>
        <td class="muted">${esc(d.reason ?? '')}</td>
      </tr>`,
    )
    .join('');
  return c.html(
    page({
      title: 'activity',
      counts: nav,
      content: `
        <h1>Activity</h1>
        ${rows ? `<table><thead><tr><th>When</th><th>Decision</th><th>Record</th><th>Actor</th><th>Reason</th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="empty">No decisions yet.</div>'}`,
    }),
  );
});
