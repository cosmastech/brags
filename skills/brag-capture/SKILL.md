---
name: brag-capture
description: Capture, normalize, and sanitize personal brag records from work tools, GitHub, manual notes, and other evidence sources. Use when collecting accomplishments or adding entries to a brag warehouse.
disable-model-invocation: true
---

# Brag Capture

## Purpose

Capture work and personal accomplishments into a private brag warehouse.

The warehouse stores normalized records, not raw transcripts. Treat Slack, Jira, GitLab, customer data, incidents, internal docs, and company-specific context as sensitive until the user explicitly marks a record public-safe.

## Warehouse Location

When writing records, first locate the warehouse:

1. Use `$BRAG_HOME` if set.
2. If the current workspace appears to be the brag warehouse, use it.
3. Otherwise stop and ask the user where to write records. Do not create records until the warehouse location is known.

If `$BRAG_HOME` is not set, tell the user they can set it to the brag warehouse path:

```shell
export BRAG_HOME="/path/to/brags"
```

For zsh, they can make it persistent with:

```shell
echo 'export BRAG_HOME="/path/to/brags"' >> ~/.zshrc
```

Expected layout:

```text
inbox/
  work/
  personal/
entries/
  YYYY/
```

Use JSONL for canonical records.

## Core Workflow

1. Identify the task mode:
   - Capture evidence from available tools.
   - Normalize provided notes into brag records.
2. Gather evidence from the available context and MCPs. Prefer structured sources like Jira, GitLab, GitHub, commits, and PRs before noisier sources like Slack.
3. Convert evidence into normalized activity records. For the complete field reference, read `RECORD_SCHEMA.md`.
4. Apply the privacy filter before writing:
   - Do not store raw message bodies, customer secrets, credentials, private incident details, unreleased strategy, or confidential financial data.
   - Keep source links when useful, but mark work links as private.
   - Set `public_safe` to `false` unless the record is clearly safe for external publication.
5. Write new records to `inbox/work/YYYY-MM-DD.jsonl` or `inbox/personal/YYYY-MM-DD.jsonl` unless the user asks for a different destination.
6. Preserve provenance. Each record should explain where it came from well enough that future review can be audited.

## Capture Guidelines

Prefer accomplishments over activity logs. A useful record usually includes:

- What changed.
- Why it mattered.
- The user's role.
- Evidence or source link.
- Impact, even if estimated.
- Follow-up needed before making it public.

When evidence is thin, still capture the record but set `confidence` to `low` and add `needs_review: true`.

When multiple sources refer to the same accomplishment, create one record with multiple evidence items instead of duplicate records.

## Quality Bar

Records should be concise, attributable, and reviewable. If unsure whether something is sensitive, store less detail and mark it for review.
