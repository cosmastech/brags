# Brag Record Schema

Use one JSON object per line. Fields should be stable enough for later import into SQLite, but flexible enough for manual capture.

## Required Fields

```json
{
  "id": "2026-05-21-gitlab-return-processing-reliability",
  "date": "2026-05-21",
  "source": "gitlab",
  "title": "Improved return processing reliability",
  "summary": "Investigated and fixed a failure mode in return processing.",
  "visibility": "private",
  "public_safe": false
}
```

## Field Reference

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string | Yes | Stable slug. Prefer `YYYY-MM-DD-source-short-title`. |
| `date` | string | Yes | ISO date for when the work happened or was completed. |
| `source` | string | Yes | Example: `manual`, `jira`, `gitlab`, `github`, `slack`, `notion`. |
| `title` | string | Yes | Short accomplishment title. |
| `summary` | string | Yes | One to three sentences describing the work. |
| `visibility` | string | Yes | One of `private`, `work_internal`, `public`. |
| `public_safe` | boolean | Yes | `true` only when safe for external publication. |
| `source_url` | string | No | Primary evidence URL. Work links are usually private. |
| `evidence` | array | No | Additional evidence objects. |
| `behavioral_evidence` | array | No | Evidence-backed observations about how the user worked. Capture-time dimension mappings are suggestions, not confirmed interview claims. |
| `project` | string | No | Project, initiative, or area. Avoid confidential names in public records. |
| `role` | string | No | What the user personally did. |
| `impact` | string | No | Outcome, metric, user benefit, or business value. |
| `tags` | array | No | Topics such as `reliability`, `mentorship`, `performance`, `security`, `manager-feedback`, `peer-feedback`, `performance-review`, or `growth-area`. |
| `people` | array | No | Collaborators or stakeholders. Avoid adding people unless useful. |
| `confidence` | string | No | One of `low`, `medium`, `high`. Defaults to `medium`. |
| `needs_review` | boolean | No | Use `true` when impact, privacy, or facts need review. |
| `notes` | string | No | Private context for future review. |
| `created_at` | string | No | ISO timestamp for record creation. |
| `updated_at` | string | No | ISO timestamp for later edits. |

## Evidence Objects

Use evidence objects when multiple sources support one accomplishment.

```json
{
  "type": "merge_request",
  "url": "https://gitlab.example.com/group/project/-/merge_requests/123",
  "title": "Fix retry handling",
  "visibility": "work_internal"
}
```

Evidence fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `type` | string | Yes | Example: `issue`, `merge_request`, `commit`, `thread`, `doc`, `manual_note`. Use `doc` or `thread` for review-cycle feedback sources. |
| `url` | string | No | Source URL. |
| `title` | string | No | Source title or short label. |
| `visibility` | string | No | One of `private`, `work_internal`, `public`. |
| `quote` | string | No | Avoid raw quotes from private systems unless explicitly needed. |

## Behavioral Evidence Objects

Use behavioral evidence when the sources support an observation about how the user operated. Store the distilled observation and provenance rather than raw conversations.

```json
{
  "signal": "bias-for-action",
  "supports": ["ownership", "ambiguity"],
  "basis": "Started a limited production rollout and gathered evidence while the broader implementation plan was still being resolved.",
  "confidence": "medium",
  "evidence_refs": [
    "https://gitlab.example.com/group/project/-/merge_requests/123",
    "https://example.slack.com/archives/CHANNEL/p123456789"
  ]
}
```

Behavioral evidence fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `signal` | string | Yes | Concise behavior such as `bias-for-action`, `influence-without-authority`, `risk-judgment`, `customer-empathy`, or `systems-thinking`. |
| `supports` | array | No | Zero or more suggested dimensions: `scope`, `ownership`, `ambiguity`, `perseverance`, `conflict-resolution`, `growth`, `communication`, or `leadership`. |
| `basis` | string | Yes | Short explanation of what evidence supports the observation. |
| `confidence` | string | Yes | One of `low`, `medium`, `high`. |
| `evidence_refs` | array | No | URLs or stable labels that point to items already represented in the record's evidence. Do not copy raw conversations here. |

Do not add a behavioral observation based only on a successful result. The basis should identify the user's decision, action, communication, response, or learning. A later review may confirm, change, or remove the suggested dimensions.

## Feedback Records

Manager, peer, and review-cycle feedback uses the same record shape as other brags. Capture the feedback theme as the accomplishment evidence; do not create a record for "wrote my review" unless writing the review is itself the accomplishment.

```json
{
  "id": "2026-07-03-notion-manager-feedback-technical-leadership",
  "date": "2026-07-03",
  "source": "notion",
  "source_url": "https://notion.example.com/performance-review",
  "title": "Manager feedback recognized technical leadership growth",
  "summary": "Manager feedback from the review cycle called out improved technical leadership and clearer cross-team communication.",
  "project": "Performance review",
  "role": "Received and captured manager-observed impact as evidence for future review.",
  "impact": "Provides third-party evidence for leadership and influence claims.",
  "tags": ["manager-feedback", "performance-review", "leadership"],
  "visibility": "private",
  "public_safe": false,
  "confidence": "high",
  "needs_review": true,
  "evidence": [
    {
      "type": "doc",
      "url": "https://notion.example.com/performance-review",
      "title": "Q2 performance review",
      "visibility": "private"
    }
  ],
  "notes": "Summarized from private review feedback. Keep raw wording private unless the user explicitly approves quoting it."
}
```

## Complete Example

```json
{
  "id": "2026-05-21-jira-checkout-error-triage",
  "date": "2026-05-21",
  "source": "jira",
  "source_url": "https://company.atlassian.net/browse/TEAM-123",
  "title": "Triaged checkout error affecting high-priority merchant",
  "summary": "Investigated a checkout failure, identified the upstream configuration issue, and gave support a concrete merchant-facing resolution.",
  "project": "Checkout reliability",
  "role": "Led the technical investigation and translated findings into support guidance.",
  "impact": "Reduced time-to-resolution for a merchant-impacting issue.",
  "tags": ["support", "debugging", "checkout", "merchant-impact"],
  "visibility": "work_internal",
  "public_safe": false,
  "confidence": "high",
  "needs_review": true,
  "evidence": [
    {
      "type": "issue",
      "url": "https://company.atlassian.net/browse/TEAM-123",
      "title": "Checkout error investigation",
      "visibility": "work_internal"
    }
  ],
  "notes": "Before making this public, remove merchant-specific context and verify the project name is safe."
}
```
