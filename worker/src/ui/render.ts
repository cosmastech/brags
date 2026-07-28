export function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}

// Marked accepts raw HTML by default. Story text is agent-generated, so escape
// HTML before parsing while preserving normal Markdown syntax.
export function escapeRawHtml(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export interface NavCounts {
  brags: Record<string, number>;
  stories: number;
}

const CSS = `
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; background: #f8fafc; color: #0f172a; }
  header { background: #0f172a; color: #fff; padding: 0.75rem 1.25rem; display: flex; gap: 1.25rem; align-items: baseline; flex-wrap: wrap; }
  header .brand { font-weight: 700; margin-right: 0.5rem; }
  header a { color: #cbd5e1; text-decoration: none; font-size: 0.9rem; }
  header a:hover { color: #fff; }
  header a .n { color: #64748b; font-size: 0.8rem; }
  main { max-width: 1080px; margin: 1.5rem auto; padding: 0 1.25rem; }
  h1 { font-size: 1.4rem; margin: 0 0 1rem; }
  h2 { font-size: 1.05rem; margin: 1.75rem 0 0.5rem; }
  table { border-collapse: collapse; width: 100%; background: #fff; }
  th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid #e2e8f0; font-size: 0.9rem; vertical-align: top; }
  th { color: #64748b; font-weight: 600; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.03em; }
  a { color: #2563eb; }
  .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 1rem 1.25rem; margin-bottom: 1rem; }
  .badge { display: inline-block; background: #e2e8f0; border-radius: 999px; padding: 0.1rem 0.6rem; font-size: 0.75rem; color: #334155; margin: 0.1rem 0.15rem 0.1rem 0; }
  .badge.state-inbox { background: #fef3c7; color: #92400e; }
  .badge.state-active { background: #dcfce7; color: #166534; }
  .badge.state-archived { background: #e2e8f0; color: #475569; }
  .badge.state-merged { background: #dbeafe; color: #1e40af; }
  .badge.review { background: #fee2e2; color: #991b1b; }
  .badge.ready { background: #dcfce7; color: #166534; }
  .badge.draft { background: #fef3c7; color: #92400e; }
  .meta { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.4rem 1.5rem; font-size: 0.88rem; }
  .meta dt { color: #64748b; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.03em; }
  .meta dd { margin: 0; }
  .flash-ok { background: #dcfce7; border: 1px solid #86efac; padding: 0.6rem 1rem; border-radius: 0.5rem; margin-bottom: 1rem; }
  .flash-err { background: #fee2e2; border: 1px solid #fca5a5; padding: 0.6rem 1rem; border-radius: 0.5rem; margin-bottom: 1rem; }
  form.inline { display: inline; }
  .btn { display: inline-block; border: 1px solid #cbd5e1; background: #fff; border-radius: 0.375rem; padding: 0.35rem 0.9rem; font-size: 0.85rem; cursor: pointer; color: #0f172a; }
  .btn:hover { background: #f1f5f9; }
  .btn.primary { background: #0f172a; color: #fff; border-color: #0f172a; }
  .btn.danger { color: #b91c1c; border-color: #fca5a5; }
  input[type='text'], input[type='date'], input[type='password'], select, textarea {
    width: 100%; padding: 0.4rem 0.55rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; font-size: 0.9rem; font-family: inherit; background: #fff;
  }
  textarea { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  label { display: block; font-size: 0.8rem; color: #475569; margin: 0.75rem 0 0.2rem; }
  .filters { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 0 0.75rem; align-items: end; }
  .actions { display: flex; gap: 0.5rem; align-items: end; flex-wrap: wrap; }
  .actions form { display: flex; gap: 0.5rem; align-items: end; }
  .actions input[type='text'] { width: 16rem; }
  details { margin-top: 1rem; }
  summary { cursor: pointer; font-weight: 600; font-size: 0.9rem; }
  .checks { display: flex; gap: 1rem; flex-wrap: wrap; margin-top: 0.4rem; }
  .checks label { display: flex; gap: 0.35rem; align-items: center; margin: 0; font-size: 0.85rem; }
  .checks input { width: auto; }
  .md { line-height: 1.6; }
  .md h1, .md h2, .md h3 { margin: 1.2rem 0 0.4rem; }
  .muted { color: #64748b; font-size: 0.85rem; }
  .empty { color: #64748b; padding: 2rem; text-align: center; background: #fff; border: 1px dashed #cbd5e1; border-radius: 0.5rem; }
`;

export function page(opts: { title: string; counts?: NavCounts; flash?: { msg?: string; error?: string }; content: string }): string {
  const c = opts.counts;
  const nav = c
    ? `<a href="/ui">Inbox <span class="n">${c.brags.inbox ?? 0}</span></a>
       <a href="/ui?state=active">Active <span class="n">${c.brags.active ?? 0}</span></a>
       <a href="/ui?state=archived">Archived <span class="n">${c.brags.archived ?? 0}</span></a>
       <a href="/ui/stories">Stories <span class="n">${c.stories}</span></a>
       <a href="/ui/activity">Activity</a>
       <a href="/export">Export</a>
       <a href="/logout">Log out</a>`
    : '';
  const flash = opts.flash?.error
    ? `<div class="flash-err">${esc(opts.flash.error)}</div>`
    : opts.flash?.msg
      ? `<div class="flash-ok">${esc(opts.flash.msg)}</div>`
      : '';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(opts.title)} · brags</title>
  <style>${CSS}</style>
</head>
<body>
  <header><span class="brand">brags</span>${nav}</header>
  <main>${flash}${opts.content}</main>
</body>
</html>`;
}

export function loginPage(hasError: boolean): string {
  return page({
    title: 'Log in',
    content: `
      <div class="card" style="max-width: 22rem; margin: 4rem auto;">
        <h1>Log in</h1>
        ${hasError ? '<div class="flash-err">Wrong password.</div>' : ''}
        <form method="post" action="/login">
          <label for="password">Password</label>
          <input type="password" id="password" name="password" autofocus>
          <div style="margin-top: 1rem;"><button class="btn primary" type="submit">Log in</button></div>
        </form>
      </div>`,
  });
}

export function stateBadge(state: unknown): string {
  return `<span class="badge state-${esc(state)}">${esc(state)}</span>`;
}

export function badges(items: unknown[], cls = ''): string {
  return (items ?? []).map((t) => `<span class="badge ${cls}">${esc(t)}</span>`).join('');
}
