---
name: brag-capture
description: Capture, normalize, and sanitize personal brag records from work tools, GitHub, manual notes, manager feedback, peer feedback, and other evidence sources. Use when collecting accomplishments, review feedback, or adding entries to a brag warehouse.
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

## Repository Sync

The brag warehouse should normally be a private Git repository, separate from the public skill/schema repository. Treat the use of this skill as intent to keep that private warehouse synchronized unless the user explicitly says not to sync.

Before reading or writing records:

1. Confirm `$BRAG_HOME` exists and is a Git repository.
2. Check `git -C "$BRAG_HOME" status --short`.
3. If there are existing uncommitted changes that were not created by the current capture session, stop and ask before continuing.
4. Pull the latest remote state with `git -C "$BRAG_HOME" pull --ff-only`.
5. If the pull fails because the local branch diverged or has conflicts, stop and ask before editing records.

After writing records or generated artifacts:

1. Validate all JSONL files under `$BRAG_HOME`.
2. Review `git -C "$BRAG_HOME" status --short` and only stage files in the brag warehouse that belong to the capture/update.
3. Commit the warehouse changes with a concise message such as `Update brag records`.
4. Push the private warehouse repository so another machine can pull the latest records.
5. If there are no warehouse changes after capture, do not create an empty commit.

Never commit or push unrelated repositories as part of the sync step. The public skill/schema repository should only be changed when the user explicitly asks to update the skill itself.

## Core Workflow

1. Identify the task mode:
   - Capture evidence from available tools.
   - Normalize provided notes into brag records.
2. Run the repository sync preflight for `$BRAG_HOME`.
3. Gather evidence from the available context and MCPs. Prefer structured sources like Jira, GitLab, GitHub, commits, and PRs before noisier sources like Slack.
4. Convert evidence into normalized activity records. For the complete field reference, read `RECORD_SCHEMA.md`.
5. Apply the privacy filter before writing:
   - Do not store raw message bodies, customer secrets, credentials, private incident details, unreleased strategy, or confidential financial data.
   - Keep source links when useful, but mark work links as private.
   - Set `public_safe` to `false` unless the record is clearly safe for external publication.
6. Write new records to `inbox/work/YYYY-MM-DD.jsonl` or `inbox/personal/YYYY-MM-DD.jsonl` unless the user asks for a different destination.
7. Preserve provenance. Each record should explain where it came from well enough that future review can be audited.
8. Run the repository sync completion steps for `$BRAG_HOME`.

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

## Feedback Capture

Manager, peer, and review-cycle feedback can become brag records when it describes demonstrated strengths, impact, growth, or externally observed behavior. Do not capture it as "wrote my review" unless creating the review itself is the accomplishment.

For feedback records:

- Use the original source, usually `notion`, `manual`, `slack`, or `jira`.
- Add tags such as `manager-feedback`, `peer-feedback`, `performance-review`, `review-cycle`, or `growth-area`.
- Summarize the feedback theme; do not store raw review text unless the user explicitly asks.
- Link the review document or feedback thread in `evidence` with type `doc`, `thread`, or `manual_note`.
- Set `visibility` to `private` or `work_internal`, `public_safe` to `false`, and `needs_review` to `true`.
- Use `impact` for what the feedback supports, and `notes` for private context about review-cycle interpretation.

## Quality Bar

Records should be concise, attributable, and reviewable. If unsure whether something is sensitive, store less detail and mark it for review.
