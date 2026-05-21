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
| `project` | string | No | Project, initiative, or area. Avoid confidential names in public records. |
| `role` | string | No | What the user personally did. |
| `impact` | string | No | Outcome, metric, user benefit, or business value. |
| `tags` | array | No | Topics such as `reliability`, `mentorship`, `performance`, `security`. |
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
| `type` | string | Yes | Example: `issue`, `merge_request`, `commit`, `thread`, `doc`, `manual_note`. |
| `url` | string | No | Source URL. |
| `title` | string | No | Source title or short label. |
| `visibility` | string | No | One of `private`, `work_internal`, `public`. |
| `quote` | string | No | Avoid raw quotes from private systems unless explicitly needed. |

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
