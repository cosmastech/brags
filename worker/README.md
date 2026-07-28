# brags worker

The hosted brag warehouse: a Cloudflare Worker exposing a JSON API and a small
web UI, backed by Cloudflare D1 (SQLite). Design and rationale live in
`bragbook-data/HOSTED_WAREHOUSE_PLAN.md`.

## Layout

- `src/` — Worker code (API routes in `routes/api.ts`, UI in `routes/ui.ts`, data layer in `store.ts`)
- `migrations/` — D1 schema migrations (`wrangler d1 migrations apply`)
- `tools/import.mjs` — one-time importer from the JSONL warehouse
- `../scripts/bootstrap.sh` — one-time hosted setup (D1, secrets, deploy)

## Auth

Everything except `/login` and `/health` requires one of:

- `Authorization: Bearer <token>` — tokens are `name:token` pairs in the `API_TOKENS` secret, one per machine. The name becomes the `actor` on review decisions.
- The UI session cookie, set by logging in at `/login` with the `UI_PASSWORD` secret.

Cloudflare Access (Stage B in the plan) can later sit in front of all of this unchanged.

## Local development

```shell
pnpm install
cp .dev.vars.example .dev.vars
pnpm migrate:local     # applies migrations to the local D1 emulator
pnpm dev               # serves on http://localhost:8787
```

Then:

```shell
curl -s http://localhost:8787/health
curl -s -H 'Authorization: Bearer dev-token' http://localhost:8787/doctor
open http://localhost:8787/ui    # password: dev-password
```

Import the real JSONL warehouse into the local instance:

```shell
BRAG_API_URL=http://localhost:8787 BRAG_TOKEN=dev-token pnpm import:data
```

Run the end-to-end smoke test against the local Worker:

```shell
pnpm test:smoke
```

It exercises capture, safe retries, dispositions, merge, stories, read-only SQL,
export, auth, and the UI. It refuses remote targets unless
`ALLOW_REMOTE_SMOKE=1` because it deliberately writes `smoke-*` records.

The importer reads `../bragbook-data` (or `--dir`, or `$BRAG_HOME`), posts every
record and story through the API, and verifies record/evidence/story counts
against `/doctor`.

## First deploy

```shell
../scripts/bootstrap.sh
```

Creates the D1 database, fills `database_id` into `wrangler.toml`, generates and
sets secrets, applies migrations remotely, and deploys to the free
`*.workers.dev` hostname. It prints the env vars for both laptops and the UI
password at the end.

Then import for real and freeze `bragbook-data` writes.

## API summary

```text
POST   /brags                 capture; upsert on id (retries are safe)
GET    /brags                 filters: state, since, until, source, project, tag, needs_review, q, limit, offset
GET    /brags/:id             record + evidence + behavioral evidence + decision history
PATCH  /brags/:id             refine fields (absent = unchanged, null = clear)
POST   /brags/:id/promote     inbox -> active ("keep")
POST   /brags/:id/archive     { reason }  ("drop"; soft delete, audited)
POST   /brags/:id/unarchive   archived -> inbox
POST   /brags/merge           { canonical_id, other_ids, reason }
GET    /stories?status&dimension
POST   /stories               upsert; links via source_brag_ids
GET    /stories/:id
PATCH  /stories/:id
POST   /query                 SELECT-only escape hatch
GET    /export                full JSON dump (the exit hatch)
GET    /doctor                counts + integrity checks
```

Field names and enums mirror `../skills/brag-capture/RECORD_SCHEMA.md`; story
fields mirror `../skills/brag-review/STORY_SCHEMA.md`. Invariant enforced on
every write: `visibility: "public"` requires `public_safe: true`.
