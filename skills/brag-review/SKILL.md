---
name: brag-review
description: Review and curate captured brag records, remove routine activity, merge related evidence, promote meaningful accomplishments, and turn strong records into persisted behavioral interview stories. Use when cleaning a brag warehouse, trimming noisy JSONL, reviewing brags, or preparing interview stories.
disable-model-invocation: true
---

# Brag Review

## Purpose

Turn a noisy inbox of possible accomplishments into a smaller set of meaningful reviewed entries and interview stories.

Capture favors recall. Review favors signal.

```text
evidence -> inbox candidates -> reviewed entries -> interview stories
```

Read `../brag-capture/RECORD_SCHEMA.md` before changing JSONL records and `STORY_SCHEMA.md` before writing a story.

## Warehouse Location

Use `$BRAG_HOME` when set. Otherwise use the current workspace only if it clearly has the expected brag warehouse layout. If the location remains unclear, ask before reading or writing records.

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

Use `entries/YYYY/work.jsonl` and `entries/YYYY/personal.jsonl` for promoted records unless the warehouse already follows another convention.

## Repository Sync

Treat use of this skill as intent to keep the private warehouse synchronized unless the user says otherwise.

Before reviewing:

1. Confirm the warehouse exists and is a Git repository.
2. Check `git -C "$BRAG_HOME" status --short`.
3. Stop and ask if unrelated uncommitted changes exist.
4. Pull with `git -C "$BRAG_HOME" pull --ff-only`.
5. Stop and ask if the branch diverged or the pull cannot complete cleanly.

After applying a review:

1. Validate every JSONL file under the warehouse.
2. Review the diff and confirm it contains only the accepted review changes.
3. Stage only those changes.
4. Commit with a concise message such as `Review brag records`.
5. Push the private warehouse.
6. Do not create an empty commit.

Never commit or push the public skill repository as part of a warehouse review.

## Review Scope

If the user names records, a date range, a project, a dimension, or an interview question, use that scope.

Otherwise select a small coherent batch from `inbox/`, normally three to five records related by project, source, or time. Do not present the user with the entire warehouse at once.

The goal is not to preserve every activity. Git history provides recovery for records removed from the active dataset.

## Core Workflow

1. Run the repository sync preflight.
2. Read the selected records and find related records elsewhere in the warehouse.
3. Inspect their existing evidence and behavioral observations.
4. Re-fetch focused evidence from GitLab, GitHub, Jira, Slack, Notion, commits, or documents when it can resolve an important question.
5. Recommend a disposition for each record or cluster.
6. Ask focused questions one at a time for decisions the evidence cannot resolve.
7. Record the user's decisions without editing files mid-conversation.
8. Summarize the proposed removals, merges, promotions, record edits, and stories.
9. Apply only the decisions the user accepted.
10. Validate, commit, and push the warehouse changes.

## Decide What Survives

Evaluate records using these questions:

- What did the user personally do beyond routine expectations?
- What decision, trade-off, influence, adaptation, or learning was distinctive?
- What changed because of the user's actions?
- Were the stakes or results meaningful?
- Does the evidence support the claim?
- Would the record help with a performance review, resume, or interview?

Volume, busyness, adversity, or completing a normal rotation does not make a record meaningful by itself.

A retained record normally has at least two of:

- Distinct personal agency.
- Non-routine judgment or decisions.
- Meaningful impact or stakes.
- A difficult obstacle, disagreement, or ambiguity.
- Observable behavioral evidence.
- Learning that changed later behavior.

## Dispositions

Recommend one of these outcomes:

### Drop

Use when the record is routine, duplicative, unsupported, or not useful. Remove it from active JSONL after the user agrees. Do not create an archive copy unless requested.

### Merge

Use when a record is useful evidence for a larger accomplishment but weak by itself.

- Choose one surviving record.
- Incorporate distinct facts, role, impact, behavioral evidence, and provenance.
- Keep all useful evidence links.
- Remove redundant records after the user agrees.
- Do not inflate several small activities into a large impact claim.

### Keep

Use when the record is meaningful but does not need a full interview story.

- Refine vague claims.
- Separate the user's role from the team's result.
- Update behavioral evidence when the review confirms or rejects it.
- Move the record from `inbox/` to the appropriate `entries/YYYY/*.jsonl` file.

### Keep and Build a Story

Use when the accomplishment has specific actions, meaningful stakes or results, and useful behavioral signal.

- Perform the same refinement and promotion as `Keep`.
- Run the short story interview.
- Persist the story using `STORY_SCHEMA.md`.

### Defer

Use only when missing evidence or a user decision prevents a sound disposition. Leave the record in `inbox/` and state what would resolve it.

## Conversation Style

Recommend a disposition before asking the user to decide. Be willing to say that a record is not meaningful.

Ask one question at a time. Each question should:

- Address a decision that changes whether or how the record survives.
- Include the evidence-based provisional answer.
- Let the user confirm, correct, or reject that interpretation.

Example:

> I recommend dropping this release record because the evidence currently shows a normal rotation under difficult conditions, not a distinctive contribution. Did you make a decision or change that affected the outcome, or is dropping it right?

If a tool or repository can answer the question, investigate instead of asking the user to remember it.

## Short Story Interview

Do not conduct an exhaustive interview. Ask no more than five questions for a story unless the user asks to go deeper, and stop sooner when the evidence is complete.

Resolve only the important gaps:

1. Why did the situation matter?
2. What did the user personally decide or do?
3. What was difficult, uncertain, or contested?
4. What changed as a result?
5. What did the user learn or later apply?

Draft the answer using CARL:

- Context
- Actions
- Results
- Learnings

Confirm which dimensions the completed story demonstrates:

- `scope`
- `ownership`
- `ambiguity`
- `perseverance`
- `conflict-resolution`
- `growth`
- `communication`
- `leadership`

One story may demonstrate several dimensions, but every confirmed dimension must have specific support in the story.

## Applying the Review

After the conversation, make the warehouse match the accepted decisions:

- Dropped records disappear from active JSONL.
- Merged records disappear after their useful evidence is preserved.
- Kept records move from `inbox/` to `entries/`.
- New facts learned during review update the surviving record.
- Confirmed behavioral interpretations update `behavioral_evidence`.
- Strong stories are written to `stories/YYYY/<story-id>.md`.
- Processed inbox files that become empty are removed.

Preserve record IDs when promoting or merging unless changing an ID is necessary to represent a substantially different combined accomplishment.

Do not warehouse raw Slack threads, meeting transcripts, or bulk exports. Fetch them as working evidence, then retain only concise facts, behavioral observations, source links, and the resulting story.

## Quality Bar

The reviewed warehouse should become smaller and more useful. A review that merely rewrites every inbox record without dropping or merging weak material has probably failed.

Never invent impact, individual ownership, conflict, or learning. If the evidence and user cannot support a strong claim, weaken it or remove it.
