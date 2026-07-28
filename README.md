# brags

Agent skills and hosted tooling for maintaining a private accomplishment warehouse.

## Skills

- `brag-capture` gathers possible accomplishments and supporting behavioral evidence.
- `brag-review` removes routine activity, merges related records, promotes meaningful accomplishments, and builds behavioral interview stories.

```text
evidence -> inbox candidates -> reviewed entries -> interview stories
```

## Hosted warehouse

`worker/` contains a Cloudflare Worker backed by D1 (hosted SQLite):

- a validated JSON API for agents
- a small browser UI for Keep / Drop / Merge and story editing
- single-token authentication on the free `*.workers.dev` hostname
- JSON export and optional R2 backups
- an importer for the existing JSONL + Markdown warehouse

See [`worker/README.md`](worker/README.md) for local development and deployment.
Run [`scripts/bootstrap.sh`](scripts/bootstrap.sh) for the first Cloudflare deploy.

The existing skills retain their JSONL/git instructions until the hosted Worker is deployed and the data import is verified. They will be switched to the API as the final cutover step, not before.

## Privacy

This public repository contains only code, schemas, and skill instructions. Personal accomplishment records remain private: currently in the separate `bragbook-data` repository, and after cutover in the user's private D1 database.
