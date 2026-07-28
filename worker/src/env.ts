export interface Env {
  DB: D1Database;
  BACKUPS?: R2Bucket;
  API_TOKENS?: string; // "work:token1,personal:token2"
  UI_PASSWORD?: string;
  COOKIE_SECRET?: string;
}

export type AppEnv = { Bindings: Env; Variables: { actor: string } };
