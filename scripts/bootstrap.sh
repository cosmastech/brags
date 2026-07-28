#!/usr/bin/env bash
# One-time setup for the hosted brag warehouse. Safe to re-run.
#
# Does: wrangler login check -> create D1 -> write database_id into wrangler.toml
#       -> set generated secrets -> apply migrations -> deploy to workers.dev
#
# The only interactive step is `wrangler login` (browser opens once).
# Secrets are printed at the end; store them somewhere safe (they are also
# re-readable anytime via the Cloudflare dashboard, except the generated values
# below, which are shown only once).
set -euo pipefail

cd "$(dirname "$0")/../worker"

echo "==> Installing pinned dependencies"
pnpm install --frozen-lockfile

echo "==> Checking wrangler login"
if ! pnpm exec wrangler whoami >/dev/null 2>&1; then
  pnpm exec wrangler login
fi

echo "==> Creating D1 database 'brags' (if needed)"
CREATE_OUT=$(pnpm exec wrangler d1 create brags 2>&1 || true)
UUID_RE='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
if echo "$CREATE_OUT" | grep -qi 'already exists'; then
  DB_ID=$(pnpm exec wrangler d1 list | grep -w brags | grep -oE "$UUID_RE" | head -1)
else
  echo "$CREATE_OUT"
  DB_ID=$(echo "$CREATE_OUT" | grep -oE "$UUID_RE" | head -1)
fi
if [ -z "${DB_ID:-}" ]; then
  echo "Could not determine the database id. Run 'pnpm exec wrangler d1 list' and put the id in wrangler.toml manually."
  exit 1
fi
sed -i '' "s/^database_id = .*/database_id = \"$DB_ID\"/" wrangler.toml
echo "    database_id = $DB_ID"

echo "==> Applying migrations"
pnpm exec wrangler d1 migrations apply brags --remote

echo "==> Creating the Worker"
pnpm exec wrangler deploy

echo "==> Generating and setting secrets"
WORK_TOKEN=$(openssl rand -hex 32)
PERSONAL_TOKEN=$(openssl rand -hex 32)
UI_PASSWORD=$(openssl rand -hex 12)
COOKIE_SECRET=$(openssl rand -hex 32)
printf 'work:%s,personal:%s' "$WORK_TOKEN" "$PERSONAL_TOKEN" | pnpm exec wrangler secret put API_TOKENS
printf '%s' "$UI_PASSWORD" | pnpm exec wrangler secret put UI_PASSWORD
printf '%s' "$COOKIE_SECRET" | pnpm exec wrangler secret put COOKIE_SECRET

echo "==> Deploying with secrets"
pnpm exec wrangler deploy

cat <<EOF

============================================================
Done. Save these — the generated values are shown only once.

Work laptop env:
  export BRAG_API_URL="https://brags.<your-subdomain>.workers.dev"
  export BRAG_TOKEN="$WORK_TOKEN"

Personal laptop env:
  export BRAG_API_URL="https://brags.<your-subdomain>.workers.dev"
  export BRAG_TOKEN="$PERSONAL_TOKEN"

Web UI:
  https://brags.<your-subdomain>.workers.dev/ui
  password: $UI_PASSWORD

Next: import the existing warehouse with
  cd worker
  BRAG_API_URL="https://brags.<your-subdomain>.workers.dev" BRAG_TOKEN="$PERSONAL_TOKEN" pnpm import:data
============================================================
EOF
