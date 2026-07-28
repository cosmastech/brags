import { Hono } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';
import type { AppEnv, Env } from './env';
import { COOKIE_MAX_AGE_SEC, COOKIE_NAME, makeCookieValue, requireAuth } from './auth';
import { api } from './routes/api';
import { ui } from './routes/ui';
import { ApiError } from './store';
import { loginPage } from './ui/render';

const app = new Hono<AppEnv>();

app.use('*', async (c, next) => {
  await next();
  c.header('Content-Security-Policy', "default-src 'self'; style-src 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  c.header('Referrer-Policy', 'no-referrer');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
});

app.onError((e, c) => {
  if (e instanceof ApiError) return c.json({ error: e.message }, e.status as 400);
  if (e instanceof SyntaxError) return c.json({ error: 'invalid JSON body' }, 400);
  console.error(e);
  return c.json({ error: 'internal error' }, 500);
});

// Public routes (registered before the auth middleware on purpose).
app.get('/health', (c) => c.json({ ok: true }));

app.get('/login', (c) => c.html(loginPage(c.req.query('error') === '1')));

app.post('/login', async (c) => {
  const body = await c.req.parseBody();
  if (c.env.UI_PASSWORD && body.password === c.env.UI_PASSWORD) {
    setCookie(c, COOKIE_NAME, await makeCookieValue(c.env), {
      httpOnly: true,
      secure: new URL(c.req.url).protocol === 'https:',
      sameSite: 'Lax',
      path: '/',
      maxAge: COOKIE_MAX_AGE_SEC,
    });
    return c.redirect('/ui');
  }
  return c.redirect('/login?error=1');
});

app.get('/logout', (c) => {
  deleteCookie(c, COOKIE_NAME, { path: '/' });
  return c.redirect('/login');
});

// Everything else requires a bearer token (agents) or the UI cookie (browser).
app.use('*', requireAuth);
app.route('/', api);
app.route('/ui', ui);

export default {
  fetch: app.fetch,

  // Phase 4 backups. Inert until the BACKUPS R2 binding and a cron trigger
  // are enabled in wrangler.toml.
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    if (!env.BACKUPS) return;
    const { exportDump } = await import('./store');
    const dump = await exportDump(env);
    const key = `exports/${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    ctx.waitUntil(env.BACKUPS.put(key, JSON.stringify(dump, null, 2)));
  },
};
