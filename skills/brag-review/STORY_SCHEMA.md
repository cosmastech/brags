# Interview Story Schema

Store each interview story as Markdown under `$BRAG_HOME/stories/YYYY/<story-id>.md`.

Stories are derived from reviewed brag records. They should remain traceable to those records while being easy for the user to read, edit, and practice.

## Template

```markdown
---
id: incident-aware-release-decision
title: Held an unsafe release while the team resolved an incident
date: 2026-07-15
source_brag_ids:
  - 2026-07-15-slack-three-production-releases-incident-aware
dimensions:
  - ownership
  - communication
behaviors:
  - risk-judgment
status: draft
last_reviewed_at: 2026-07-19T14:00:00Z
---

## Why this story matters

One or two sentences explaining the distinctive judgment, action, or impact.

## Context

Only the background needed to understand the stakes and the user's role.

## Actions

- Specific action the user took and why.
- Another decision, communication step, or adaptation.

## Results

What changed because of the user's actions. Distinguish verified outcomes from estimates.

## Learnings

What the user learned, would change, or later applied.

## Questions this can answer

- Tell me about a time you made a difficult judgment call.
- Tell me about a time you influenced a team during uncertainty.

## 60-second version

A concise spoken version using first person for the user's actions and shared credit for team results.

## Details to verify

- Any unresolved fact, metric, attribution, or wording.
```

## Frontmatter

| Field | Required | Notes |
| --- | --- | --- |
| `id` | Yes | Stable slug used as the filename. |
| `title` | Yes | Specific description of what made the story meaningful. |
| `date` | Yes | Date of the accomplishment or its most important outcome. |
| `source_brag_ids` | Yes | One or more IDs from reviewed JSONL entries. |
| `dimensions` | Yes | Confirmed dimensions demonstrated by the story. May be empty while drafting. |
| `behaviors` | No | Specific behaviors such as `bias-for-action` or `influence-without-authority`. |
| `status` | Yes | `draft` or `ready`. |
| `last_reviewed_at` | Yes | ISO timestamp for the latest user review. |

Supported dimensions are `scope`, `ownership`, `ambiguity`, `perseverance`, `conflict-resolution`, `growth`, `communication`, and `leadership`.

## Writing Rules

- Use CARL: Context, Actions, Results, Learnings.
- Keep context short; actions should carry most of the evidence.
- Say `I` for the user's actions and decisions. Use shared credit for team outcomes.
- Do not turn routine responsibility, volume, or adversity into impact.
- Do not fill gaps with plausible details. List unresolved details under `Details to verify`.
- Preserve provenance through `source_brag_ids`; do not copy source conversations into the story.
