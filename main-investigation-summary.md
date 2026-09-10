# Investigation Session — Behavioral Spec

Extracted from the silent-payment-capture investigation session
(`investigation-session.jsonl`, 3,315 lines, 46 MB).

## High-level numbers

| Metric | Value |
|---|---|
| User messages | 94 |
| Assistant messages | 1,508 |
| Tool invocations | 782 |
| Tool results | 782 |
| Distinct tools used | 35 |

## Tool palette by category

| Category | Calls | Top tools |
|---|---:|---|
| **Shell** | 257 | `Bash` (kubectl, pup, grep, find, python scripts) |
| **Browser** | 209 | `chrome.browser_batch` (142), `chrome.javascript_tool` (32) |
| **Filesystem** | 150 | `Read` (85), `Edit` (52), `Write` (13) |
| **Notion** | 53 | `notion.update-page` (23), `notion.fetch` (11) |
| **Planning** | 53 | `TodoWrite` |
| **Sentry** | 35 | `sentry.search_events` (17), `sentry.search_issues` (7) |
| **Discovery** | 21 | `ToolSearch` |
| **MongoDB MCP** | 0 | — (all Mongo work went through Chrome/Atlas UI + Bash) |
| **Datadog MCP** | 0 | — (RBAC-blocked; worked around via `pup` CLI + Chrome) |
| **Other** | 4 | `WebFetch`, `Agent`, `AskUserQuestion`, `ScheduleWakeup` |

## Five insights for MCP-server schema/connector design

### 1. The actual investigation used FAR more shell and browser than MCP

257 Bash calls + 209 Chrome calls = **60% of all tool activity**. Sentry MCP
(35) and Notion MCP (53) were the only MCPs that meaningfully fired.
MongoDB MCP and Datadog MCP were available but unused (0 calls each — Mongo
via Atlas UI screenshots; Datadog blocked by RBAC, fell back to `pup` CLI).

**Implication for schema:** model "connectors" as a unified abstraction over
*all four* of: native MCPs, shell commands, browser-driven UIs, and CLI tools.
Don't assume MCP-only; the real palette is broader.

### 2. Notion is the persistence layer, not just a sink

53 Notion calls — 23 of them `update-page` — means the dossier was rewritten
incrementally as evidence accumulated. Investigations aren't write-once
reports; they're append-and-revise documents.

**Implication for schema:** Investigation entity needs a versioning model.
Each evidence add/finding update should be a tracked event, not just a state.

### 3. Browser automation was indispensable

209 Chrome calls (mostly `browser_batch` for multi-action sequences) means
"go look at the UI and screenshot it" was a first-class evidence operation,
not a fallback. This came from RBAC blocks on Datadog MCP and Atlas not
having a deep-link query URL.

**Implication for connector design:** the Browser adapter is not optional.
It's the answer to "the API doesn't exist or is blocked" — which happens
constantly in real orgs.

### 4. Investigation has implicit structure

53 `TodoWrite` calls means the agent was constantly re-planning. Findings
spawn sub-investigations, dead ends require pivots, verification cycles add
loops. The flow is not linear.

**Implication for schema:** model investigations as a tree (or DAG) of
hypotheses → evidence → verdicts, not a linear sequence of steps.

### 5. Many tool calls were "verification" not "discovery"

A significant chunk of the calls were re-fetches: re-fetch Notion page after
edits, re-query Mongo to confirm a number, re-screenshot a Sentry issue.
This is *verification of side effects*, not new investigation.

**Implication for schema:** distinguish `discovery` calls from `verification`
calls in the tool-call event log. They're operationally the same but
analytically different — your dashboard will want to show "% of effort spent
verifying" separately.

## Suggested data model (starting point)

```
Investigation
  id, title, opened_at, closed_at, verdict (null until closed)
  hypothesis (initial framing)
  audience (who the dossier is for)

Hypothesis  (1:N from Investigation)
  id, investigation_id, parent_hypothesis_id (nullable, for nesting),
  claim, status (open / confirmed / refuted / inconclusive),
  created_at, resolved_at

Evidence  (1:N from Hypothesis)
  id, hypothesis_id, kind (query_result / screenshot / code_ref / external_link),
  source_connector_id, raw_payload (jsonb), summary (markdown),
  captured_at, captured_by

ToolCall  (event log)
  id, investigation_id, hypothesis_id (nullable), connector_id,
  tool_name, input (jsonb), output (jsonb), purpose (discovery / verification / capture),
  started_at, finished_at, success, error (nullable)

Connector  (adapter registry)
  id, kind (mcp / shell / browser / cli / http),
  name (e.g. "Sentry MCP", "pup CLI", "Chrome", "Atlas UI"),
  config (jsonb — auth, base URL, etc.),
  capabilities (text[] — e.g. ["query","screenshot","write"])

Finding  (closed-form claim, post-verification)
  id, investigation_id, claim, supporting_evidence_ids (uuid[]),
  contradicting_evidence_ids (uuid[]),
  confidence (low / medium / high), created_at

Document  (the dossier itself)
  id, investigation_id, format (notion / markdown), location,
  versions (jsonb[] — snapshot per revision)
```

## Artifacts in this folder

- `investigation-session.jsonl` — raw filtered conversation (3,315 lines)
- `investigation-tool-calls.csv` — flat tool-call timeline (782 rows)
- `investigation-summary.md` — this file
