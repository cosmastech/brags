import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import type { AppEnv, Env } from './env';

export const COOKIE_NAME = 'brags_ui';
export const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 14; // two weeks

// Bearer tokens are configured as comma-separated name:token pairs so each
// machine gets its own revocable identity. The name becomes the actor.
export function bearerActor(authHeader: string | undefined, env: Env): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  for (const pair of (env.API_TOKENS ?? '').split(',')) {
    const trimmed = pair.trim();
    const idx = trimmed.indexOf(':');
    if (idx === -1) continue;
    if (trimmed.slice(idx + 1) === token) return trimmed.slice(0, idx);
  }
  return null;
}

function cookieSecret(env: Env): string {
  return env.COOKIE_SECRET ?? env.UI_PASSWORD ?? '';
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function makeCookieValue(env: Env): Promise<string> {
  const expiry = Date.now() + COOKIE_MAX_AGE_SEC * 1000;
  const sig = await hmac(cookieSecret(env), String(expiry));
  return `${expiry}.${sig}`;
}

async function validCookie(value: string | undefined, env: Env): Promise<boolean> {
  if (!value) return false;
  const dot = value.lastIndexOf('.');
  if (dot === -1) return false;
  const expiry = Number(value.slice(0, dot));
  if (!Number.isFinite(expiry) || expiry < Date.now()) return false;
  const expected = await hmac(cookieSecret(env), String(expiry));
  return value.slice(dot + 1) === expected;
}

export async function requireAuth(c: Context<AppEnv>, next: Next) {
  const bearer = bearerActor(c.req.header('Authorization'), c.env);
  if (bearer) {
    c.set('actor', bearer);
    return next();
  }
  if (await validCookie(getCookie(c)[COOKIE_NAME], c.env)) {
    c.set('actor', 'ui');
    return next();
  }
  if (c.req.path.startsWith('/ui')) return c.redirect('/login');
  return c.json({ error: 'unauthorized' }, 401);
}
