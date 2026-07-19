---
name: brag-capture
description: Capture, normalize, and sanitize personal brag records from work tools, GitHub, manual notes, manager feedback, peer feedback, and other evidence sources. Use when collecting accomplishments, review feedback, or adding entries to a brag warehouse.
disable-model-invocation: true
---

# Brag Capture

## Purpose

Capture work and personal accomplishment candidates into a private brag warehouse.

Capture should favor recall over perfect curation. Records written to `inbox/` are candidates until `brag-review` drops, merges, refines, or promotes them.

The warehouse stores normalized records and behavioral observations, not raw transcripts. Treat Slack, Jira, GitLab, customer data, incidents, internal docs, and company-specific context as sensitive until the user explicitly marks a record public-safe.

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
stories/
  YYYY/
```

Use JSONL for captured and reviewed records. `inbox/` is a review queue; `entries/` contains accomplishments that survived review.

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
3. Establish what happened from available context and structured sources such as Jira, GitLab, GitHub, commits, and pull requests.
4. Look for evidence of how the user operated: decisions, initiative, judgment, ambiguity, setbacks, disagreement, communication, influence, and learning.
5. When the core evidence suggests a behavior may matter, run a bounded search of Slack, Notion, meeting notes, or related documents:
   - Search around known project names, issue or merge-request IDs, dates, and participants.
   - Prefer a few relevant threads over broad message collection.
   - Use the additional evidence to support or reject a behavioral inference.
   - Persist a short paraphrase and provenance, not copied conversations or bulk exports.
6. Convert the evidence into normalized candidate records. For the complete field reference, read `RECORD_SCHEMA.md`.
7. Apply the privacy filter before writing:
   - Do not store raw message bodies, customer secrets, credentials, private incident details, unreleased strategy, or confidential financial data.
   - Keep source links when useful, but mark work links as private.
   - Set `public_safe` to `false` unless the record is clearly safe for external publication.
8. Write new records to `inbox/work/YYYY-MM-DD.jsonl` or `inbox/personal/YYYY-MM-DD.jsonl` unless the user asks for a different destination.
9. Preserve provenance. Each record should explain where it came from well enough that future review can be audited.
10. Run the repository sync completion steps for `$BRAG_HOME`.

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

Routine work may be captured when there is a reasonable chance that later evidence will reveal meaningful judgment or impact. Do not turn volume, busyness, or an unusually difficult day into an impact claim by itself. `brag-review` is responsible for removing candidates that do not hold up.

## Behavioral Evidence

Use `behavioral_evidence` when the available sources show how the user worked, not merely what was delivered. A behavioral observation should include:

- A concise signal such as `bias-for-action`, `influence-without-authority`, `risk-judgment`, `customer-empathy`, or `systems-thinking`.
- A short basis grounded in the evidence.
- Confidence in the inference.
- References to the supporting evidence when useful.
- Any behavioral interview dimensions the signal may support.

The supported dimensions are:

- `scope`
- `ownership`
- `ambiguity`
- `perseverance`
- `conflict-resolution`
- `growth`
- `communication`
- `leadership`

The dimensions are suggestions at capture time, not confirmed interview claims. Do not force a mapping, assign every dimension, or infer behavior solely from a successful outcome. `brag-review` confirms or changes the interpretation with the user.

Capture should not interrupt the user with an interview. Gather what the tools can establish, record uncertainty, and leave focused clarification for review.

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

Records should be concise, attributable, and reviewable. Behavioral inferences must state their basis. If unsure whether something is sensitive, store less detail and mark it for review.
