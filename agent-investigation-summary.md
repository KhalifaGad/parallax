# Agent Investigation Session — Behavioral Spec

Extracted from `raw/agent-session.jsonl`. This is the **second** of two sessions
that produced the silent-payment-capture investigation. The other is the
orchestrator session (`main-investigation-session.jsonl`).

## High-level numbers

| Metric | Value |
|---|---|
| User messages | 27 |
| Assistant messages | 553 |
| Tool invocations | 283 |
| Time window | 2026-05-12 22:36 → 2026-05-13 10:41 (~12 hrs) |

## Tool palette by category

| Category | Calls | Notable |
|---|---:|---|
| **Shell** | 63 | `Bash` (kubectl, `pup` CLI for Datadog, Python scripts) |
| **Browser** | 62 | `chrome.browser_batch` (46) — for Sentry/Atlas/Datadog UI screenshots |
| **Discovery** | 40 | `ToolSearch` — agent kept loading deferred tools as needed |
| **Planning** | 31 | `TodoWrite` — investigation flow management |
| **Filesystem** | 26 | `Edit` (15), `Read` (9), `Write` (2) — dossier construction |
| **Notion** | 26 | 12 fetch + 10 update + 1 create — building the dossier itself |
| **Sentry** | 18 | 11 `search_issues` + 4 `search_events` — actual MCP queries |
| **MongoDB** | 12 | 8 `aggregate` + 2 `list-collections` + 1 `list-databases` + 1 `connect` |
| **Datadog** | 3 | Only meta-tools (`list_datadog_skills`, `load_datadog_skill`) — RBAC-blocked from query tools |
| **Other** | 2 | `Monitor` |

## How this contrasts with the orchestrator session

| Dimension | Orchestrator (mine) | Agent (this) |
|---|---|---|
| Total tool calls | 782 | 283 |
| User messages | 94 | 27 |
| Mongo MCP calls | 0 | **12** ✓ |
| Sentry MCP calls | 35 | 18 |
| Datadog MCP calls | 0 | 3 (meta only) |
| Notion calls | 53 | 26 |
| Bash calls | 257 | 63 |
| Chrome calls | 209 | 62 |
| Role | Hypothesis framing, agent prompt design, dossier review, Notion verification | Actual evidence gathering, dossier writing |

**Critical insight:** the orchestrator's `0 Mongo MCP` count from my earlier
summary was misleading on its own. The agent session shows the real palette.
Combine both sessions to see the full investigation.

## What the agent's tool usage actually reveals

### 1. ToolSearch was a primary verb (40 calls)

The agent kept discovering and loading tools as the investigation progressed —
Datadog MCP, Mongo MCP, browser tools, all loaded on demand. This is the
**deferred-tool pattern** of Claude Code, and any investigation MCP server
needs to handle it: don't assume the connector list is fixed at session start.

### 2. Datadog MCP was blocked at the data-query layer

Only the meta-tools fired (`list_datadog_skills`, `load_datadog_skill`). The
actual span-query tools were RBAC-blocked. The agent worked around this with
`pup` CLI via Bash. **For your MCP server:** plan for graceful degradation
when an API is unreachable — fall back to shell or browser equivalents.

### 3. MongoDB MCP used the standard discovery → query flow

`connect` → `list-databases` → `list-collections` → `aggregate` (8 times).
This is the canonical pattern: connect once, enumerate, then run aggregations.
**For your MCP server:** wrap this as a single "investigate" verb that
internally does the discovery dance, rather than exposing each step.

### 4. Notion writes happened in the agent session, not the orchestrator

The agent assembled the dossier (10 update-page + 1 create-pages). The
orchestrator's later Notion calls (53) were re-fetching for review and
verification. **For your MCP server:** the "dossier writer" is one role,
the "dossier reviewer" is another. They can be the same agent in two phases
or two separate agents.

### 5. Browser automation was still ~22% of activity

Even with MCP access to Mongo and Sentry, the agent still relied on
browser automation (62 calls) for things like:
- Capturing Atlas aggregation result screenshots (Mongo MCP returns JSON
  but doesn't render the breadcrumb context that makes a screenshot
  credible)
- Capturing Sentry issue page screenshots (Sentry MCP returns data but not
  the UI evidence)
- Capturing Datadog UI views (Datadog MCP was blocked entirely)

**Implication for schema:** an evidence artifact can have multiple
*representations* of the same underlying fact (JSON from MCP, screenshot
from UI, link to source). The evidence model needs to support this 1:N
relationship.

## Updated suggestions to add to the main schema

Based on what only this session reveals (and the orchestrator's didn't):

```
ToolDiscovery  (event log addition)
  id, investigation_id, attempted_at, tool_name, available (bool),
  failure_mode (rbac / not_loaded / network / null)

EvidenceArtifact  (replaces simple Evidence)
  id, hypothesis_id, claim_summary,
  representations (jsonb[] — each entry: {kind, source, raw_payload, captured_at})
  -- e.g. one "claim" can have {mongo-mcp aggregate result} + {atlas-ui screenshot} + {atlas-ui url}

ConnectorAvailability  (probe history)
  id, connector_id, probed_at, reachable (bool),
  capability_status (jsonb — per-capability: enabled/disabled/rate-limited)
```

## Artifacts in this folder

- `raw/agent-session.jsonl` — raw agent session (9 MB)
- `agent-investigation-tool-calls.csv` — flat tool-call timeline (283 rows)
- `agent-investigation-summary.md` — this file
- `main-investigation-session.jsonl` — orchestrator session, already extracted
- `main-investigation-tool-calls.csv` — orchestrator timeline (782 rows)
- `main-investigation-summary.md` — orchestrator behavioral spec

## What to do with both datasets

For schema design, treat them as **one investigation, two roles**:
- The agent session shows the **execution** layer (what tools, what queries, what evidence)
- The orchestrator session shows the **control** layer (what to investigate, what to verify, when to push back)

A complete MCP server needs to model both. The control layer is the
underrated one — most "incident MCP server" designs I'd guess focus on
the execution layer and forget that investigations require iteration,
verification, and re-direction.
