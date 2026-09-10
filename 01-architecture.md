# Technical Architecture (Locked)

> Part of the **Parallax** project context. Last updated May 2026. See `README.md` for the full file index.
>
> **What's in this file:** The locked technical spine: tech stack, tool naming, connector model, plugin architecture, three-mode credential architecture (`ConnectorContext`), two-layer authentication, subprocess pool semantics, phased Mode 1→2→3 implementation, and broad MCP client compatibility.

---

## 4. Technical Architecture (Locked)

> Tech stack decisions locked in dedicated architecture sessions after code-level review of MetaMCP, Lunar MCPX, MCPJungle, Airis MCP Gateway, and LangChain MCP adapters. Patterns and utility code referenced for adoption with attribution where allowed.

### 4.1 Architecture Diagram

```
   Engineer's LLM client (Cursor / Claude Code / Slack bot)
                            │
                            ▼ (Streamable HTTP + JSON-RPC 2.0 + MCP)
   ┌──────────────────────────────────────────────────────────┐
   │              Fastify (outer HTTP shell)                  │
   │   /mcp → MCP SDK Streamable HTTP transport handler       │
   │   /health, /ready, /webhooks/slack, /oauth/callback/*    │
   │   /api/admin, /api/trpc, etc.                            │
   └──────────────────────────┬───────────────────────────────┘
                              │
   ┌──────────────────────────▼───────────────────────────────┐
   │     Substrate (packages/core)                            │
   │   ─ MCP server (tools/resources/prompts)                 │
   │   ─ Functional middleware composition framework          │
   │   ─ Schema partitioning + expand_schema meta-tool        │
   │   ─ Connector loader, adapter pattern                    │
   │   ─ Storage abstractions (Drizzle/Postgres, Redis)       │
   │   ─ STDIO subprocess pool for upstream MCP servers       │
   │   ─ Auth (API keys, OAuth flows for connectors)          │
   │   ─ Plugin runtime (loads + hosts plugins)               │
   └─┬──────────────────────────────────────────────────┬─────┘
     │                                                  │
     ▼                                                  ▼
   ┌─────────────────────────┐    ┌──────────────────────────────┐
   │   Investigation Plugin  │    │   Connector adapters         │
   │   (packages/plugin-     │    │   (packages/connector-*)     │
   │    investigation)       │    │                              │
   │                         │    │   ─ Standard verb interface  │
   │   ─ Sessions schema     │    │   ─ Maps verb → MCP/SDK call │
   │   ─ Correlation         │    │   ─ Normalizes response      │
   │   ─ Postmortem skeleton │    │   ─ Adds _source provenance  │
   │   ─ Cost attribution    │    └──────────────┬───────────────┘
   │   ─ Slack feed          │                   │
   │   ─ Plugin's MCP tools  │                   ▼
   └─────────────────────────┘    ┌──────────────────────────────┐
                                  │  Upstream MCP servers        │
                                  │  (mostly STDIO, pooled)      │
                                  │   ─ AWS Labs CloudWatch      │
                                  │   ─ GCP Observability        │
                                  │   ─ Sentry / GitHub / etc.   │
                                  │  + SDK fallbacks for vendors │
                                  │    without MCP servers       │
                                  └──────────────┬───────────────┘
                                                 │
                                                 ▼
                                          Vendor APIs
```

### 4.2 Stack

| Layer | Choice | Notes |
|---|---|---|
| Language | TypeScript (strict mode) | Universal across MCP ecosystem |
| Runtime | Node.js 22 LTS | Broadest reach for OSS contributors. Bun supportable later. |
| Transport (MCP edge) | Streamable HTTP | Spec-defined. Persistent connections required by shared cache. |
| Message format | JSON-RPC 2.0 | Part of the MCP spec, not optional |
| HTTP framework | Fastify | Hosts MCP SDK as a route. Express 5 is defensible alternative if team prefers. |
| MCP SDK | `@modelcontextprotocol/sdk` | Official; mount its handler inside Fastify |
| Database | Postgres 16 | Sessions, audit, config, connector configs |
| ORM | Drizzle with `postgres.js` driver | Type-safe, TS-first, lightweight |
| Cache | Redis 7.x (or Valkey) | TTL-native; required for shared team cache |
| Auth library | Better Auth | Drizzle-friendly; same choice as MetaMCP |
| Schema validation | Zod | Tool inputs, config, API boundaries |
| Package manager | pnpm with workspaces | Monorepo structure |
| Build tool | tsup | Fast TS bundler |
| Test framework | Vitest | Modern, fast |
| Lint + format | Biome (or ESLint + Prettier) | Either works; Biome is simpler |
| Deployment | Docker Compose | `git clone && cp .env.example .env && docker compose up` |

**No SQLite, no in-process cache fallback.** Postgres + Redis are required. Following the pattern of Sentry, GitLab, Mattermost, Plausible, PostHog — serious infra tools require real backing stores. The audience (SREs) runs Postgres every day; `docker compose up` is acceptable friction, not a barrier.

### 4.3 Functional Middleware Composition Pattern

Adopted directly from MetaMCP. Every cross-cutting concern (PII redaction, correlation enrichment, cost tracking, cache lookup, audit logging, schema partitioning, tool overrides) is a middleware function `(handler) => handler`, composed with `reduceRight`:

```typescript
type ListToolsHandler = (req, ctx) => Promise<ListToolsResult>;
type ListToolsMiddleware = (handler: ListToolsHandler) => ListToolsHandler;

function compose<T>(...middlewares: Array<(h: T) => T>): (h: T) => T {
  return (handler) => middlewares.reduceRight(
    (wrapped, middleware) => middleware(wrapped),
    handler
  );
}

const listToolsWithMiddleware = compose(
  createSchemaPartitionMiddleware(),
  createToolOverridesMiddleware(),
  createFilterToolsMiddleware(),
  createObservabilityMiddleware(),
)(originalListToolsHandler);
```

This is the spine of the architecture. Plugins also register middleware through this pattern.

**In-process L1 cache for hot DB lookups.** Middleware that hits the database on every request (tool status checks during `tools/list`, namespace resolution, RBAC checks) sits behind a short-TTL in-process cache. MetaMCP's `ToolStatusCache` uses a 1-second TTL keyed by `${namespace}:${server}:${tool}` — short enough that staleness never matters in practice, long enough to deduplicate the burst of identical lookups inside a single fan-out call. This is an L1 cache in front of Postgres, distinct from the Redis cache that serves the cross-engineer shared cache layer. A simple `Map<string, {value, expiry}>` with manual TTL works; no library needed. Add `clear(namespace?)` for invalidation when config changes.

### 4.4 Tool Naming

`<connector>__<tool>` with double underscore separator. MCP spec mandates regex `^[a-zA-Z0-9_-]{1,64}$` — dots, colons, and slashes are forbidden. Double underscore is now the universal convention across MetaMCP, MCPJungle, Docker MCP Gateway, LangChain MCP adapters, and Claude Agent SDK.

Parsing rule (from MetaMCP, supports nested aggregation): split only on the *first* `__`. So `Parent__Child__tool` parses as `serverName: "Parent"`, `originalToolName: "Child__tool"`. Chained gateways work without breaking parsing.

**Postgres schema enforces this** via check constraints:

```sql
CONSTRAINT mcp_servers_name_regex_check CHECK (name ~ '^[a-zA-Z0-9_-]+$')
```

Defense in depth — bad data can't be inserted at the DB layer either.

### 4.5 Connector Architecture (Hybrid, MCP-Backed Default)

Each connector is a first-party npm package implementing a standard `Connector` interface. The *implementation method* inside each connector varies:

```
Connector interface (TypeScript, in connector-sdk)
  │
  ├─ Implementation A: Wraps a vendor MCP server (DEFAULT for vendors with one)
  │     ─ Spawn/connect to vendor MCP server (STDIO, SSE, or HTTP)
  │     ─ Translate vendor tool names → our standard verbs
  │     ─ Normalize their response shapes → our standard shapes
  │     ─ Attach _source provenance
  │     ─ ~100-200 lines per connector
  │
  └─ Implementation B: Direct vendor SDK call (FALLBACK for no MCP server)
        ─ Use vendor's TypeScript SDK
        ─ Manual mapping verb args → SDK call
        ─ Manual normalization of response
        ─ ~300-500 lines per connector
```

Concrete planning:

| Connector | Implementation | Underlying mechanism |
|---|---|---|
| `connector-aws-cloudwatch` | A (MCP-backed) | AWS Labs CloudWatch MCP Server (Python via uvx) |
| `connector-gcp-observability` | A (MCP-backed) | `@google-cloud/observability-mcp` (TS via npx) |
| `connector-sentry` | A (MCP-backed) | Sentry's official MCP server |
| `connector-github` | A (MCP-backed) | GitHub's official MCP server |
| `connector-cloudflare` | A (MCP-backed) | Cloudflare's official MCP server |
| `connector-stripe` | A (MCP-backed) | Stripe's official MCP server |
| `connector-datadog` | A or B | Datadog's MCP server if/when available, else REST |
| `connector-pagerduty` | A or B | Same |
| `connector-loki` (hypothetical) | B (REST/PromQL) | No official MCP server exists |

**Why hybrid, MCP-backed default:** Maintenance economics. A three-person team cannot realistically maintain 10 first-party SDK-based connectors AND build the workflow layer AND iterate on product. Vendor MCP servers are a free lunch — paid for by the vendors' own engineering teams. The investigation wedge does not require us to compete on connector quality; it requires us to add workflow primitives on top.

**STDIO subprocess pool — required infrastructure.** Most vendor MCP servers are STDIO-only (subprocess via `uvx` for Python servers, `npx` for Node servers). The substrate must:
- Spawn subprocesses for each connected vendor MCP server
- Pre-warm idle sessions to absorb cold-start latency
- Share upstream subprocesses across multiple engineer sessions
- Cleanup timer for stale sessions
- Max-total-connection cap to prevent runaway spawning

Pattern modeled directly on MetaMCP's `mcp-server-pool.ts` (file is ~720 lines; the design is well-tested).

**Tier 3 (generic MCP passthrough):** users can also register arbitrary MCP server URLs/commands at runtime via DB config (MetaMCP-style). Tools from those servers appear with the `__` prefix but do NOT participate in standard verbs, correlation, or smart cache. Use case: "I want this random community MCP server" — fine for that, but the investigation experience is degraded compared to first-party connectors. Document this distinction loudly in UX.

**Dual-surface connector interface (designed v0, shipped progressively):**

```typescript
interface Connector {
  name: string;
  version: string;

  // Surface 1: Standard verbs (fan-out, correlation, shared cache)
  capabilities: Capability[];           // ['logs.search', 'traces.search', ...]
  logsSearch?(q: LogsSearchQuery): Promise<LogsSearchResult>;
  tracesSearch?(q: TracesSearchQuery): Promise<TracesSearchResult>;
  errorsSearch?(q: ErrorsSearchQuery): Promise<ErrorsSearchResult>;
  deploysList?(q: DeploysListQuery): Promise<DeploysListResult>;

  // Surface 2: Native tools (vendor-specific, exposed as <connector>__<tool>)
  nativeTools?(): NativeTool[];
}

interface NativeTool {
  name: string;                          // e.g., 'live_tail', 'replay_search'
  description: string;
  inputSchema: ZodSchema;
  cachePolicy: CachePolicy;
  correlate: boolean;                    // default true for time-bounded results
  handler(args: unknown): Promise<unknown>;
}
```

Source attribution always preserved: every result item carries `_source: 'datadog'` (or similar). Cache and correlation policy declared by the connector author per tool; the aggregator never guesses what to cache.

**Self-reference protection.** When Tier 3 generic MCP passthrough is enabled (users registering arbitrary MCP server URLs), the connector loader must detect cases where the registered server resolves back to the aggregator itself — chained-gateway setups create infinite loops without this check. MetaMCP detects this by comparing the upstream server's reported `name` field against the aggregator's own server name (`metamcp-unified-${namespaceUuid}` in their case) and by checking basic same-server patterns (matching URL/command parameters). Adopt the same pair of checks; skip self-referential servers with a logged warning at startup, not at first call.

**Standard verb registry, not fixed set.** The SDK ships blessed schemas (`logs.search`, `traces.search`, `errors.search`, `deploys.list`) but the verb list grows over time through a lightweight RFC process — a new verb earns its way in after 3+ connectors implement it. Avoids prematurely ossifying the interface.

**Connector code is mode-agnostic via `ConnectorContext`.** See Section 4.14. The connector author writes the same code regardless of whether the subprocess will run in our cloud (Mode 1), on the engineer's laptop with local credentials (Mode 2), or on the engineer's laptop with cloud-vended ephemeral credentials (Mode 3). The runtime determines those things, not the connector.

### 4.6 Plugin Architecture (Substrate + First Plugin)

The core (`packages/core`) is the substrate: aggregator, connector loader, middleware framework, storage abstractions, MCP server. The investigation workflow is the *first plugin* (`packages/plugin-investigation`).

**Discipline: design for plugins, ship one.** Don't design a generic plugin SDK before plugin #2 exists — that produces the wrong API. Backstage, Grafana, Sentry all extracted their plugin APIs from real first plugins, not whiteboarded them in advance. We keep clean seams between core and the investigation plugin; we don't promise external plugin compatibility until plugin #2 forces extraction.

**Repository layout:**

```
parallax/                       (pnpm workspace)
├── packages/
│   ├── core/                            Substrate
│   ├── connector-sdk/                   Connector interface, helpers
│   ├── connector-aws-cloudwatch/
│   ├── connector-gcp-observability/
│   ├── connector-sentry/
│   ├── connector-github/
│   ├── connector-pagerduty/
│   ├── ... (other connectors)
│   ├── plugin-investigation/            The first plugin (bundled by default)
│   └── cli/                             Setup, doctor, install commands
├── docker-compose.yml
└── pnpm-workspace.yaml
```

**Plugin interface (initial, not yet a public SDK):**

```typescript
interface Plugin {
  name: string;                          // 'investigation'
  version: string;

  // Storage: contribute Drizzle migrations (own table namespace)
  migrations(): Migration[];

  // Tools: register MCP tools (auto-namespaced as 'investigation__<tool>')
  tools(): ToolDefinition[];

  // Middleware: hook into request lifecycle
  middleware?: {
    onListTools?: ListToolsMiddleware;
    onCallTool?: CallToolMiddleware;
  };

  // Events: subscribe to tool call lifecycle
  on?: {
    toolCallStart?: (e: ToolCallEvent) => void | Promise<void>;
    toolCallComplete?: (e: ToolCallEvent) => void | Promise<void>;
    toolCallError?: (e: ToolCallErrorEvent) => void | Promise<void>;
  };

  initialize(ctx: PluginContext): Promise<void>;
  shutdown?(): Promise<void>;
}
```

**What's core vs plugin:**

- **Core:** MCP server, connector loader, schema partitioning, middleware framework, storage abstractions, auth/RBAC, standard verb routing, subprocess pool, audit log plumbing.
- **Investigation plugin:** Sessions schema and lifecycle, correlation primitive, postmortem auto-skeleton, cost attribution, Slack feed, investigation-specific MCP tools (`investigation__create_session`, `investigation__replay`, etc.).

**Brand and packaging.** Plugin nature is implementation detail for end users. OSS install ships investigation plugin pre-enabled and active. README/marketing positions it as "an investigation MCP server" — not "a gateway with an investigation plugin." Same model as Grafana (panels are plugins but users say "I use Grafana for dashboards").

**Plausible plugin #2+ examples** (validate generality): deployment intelligence, cost optimization, compliance/audit evidence, performance/SLI tracking, security investigation. All would use the same plugin contract — tables, tools, middleware, events.

**License split (refined):**
- **Core:** FSL or BSL (protects against cloud-vendor relicensing of the managed service)
- **Connector SDK and (future) Plugin SDK:** Apache 2.0 or MIT (frictionless community contribution)
- **First-party plugins (including investigation):** same license as core (FSL/BSL)
- **Community plugins:** authors' choice

WordPress/Sentry/PostHog precedent.

### 4.7 Schema Partitioning (V0 Default)

Critical token-reduction strategy, non-optional from day one. Without it, 5+ MCP-backed connectors with ~20 tools each = 100+ tools in the LLM's tool list = degraded selection quality + 30,000+ tokens of metadata before any work.

**Pattern (port from Airis's `schema_partitioning.py`, ~200 lines of TypeScript):**

1. On `tools/list`: store full schemas internally, return *partitioned* schemas (top-level properties only — strip nested object properties). Keep `type`, `description`, `enum`, `const`, `format`, `pattern`, `required`, `default` for top-level properties only.
2. Expose `expand_schema(tool_name, path?)` meta-tool: LLM calls this when it needs full schema details for a specific tool or nested path.
3. Default behavior; opt-out per-connector if needed.

**Benchmarked elsewhere:** Airis reports ~90% token reduction on a 25-server setup. Bifrost's Code Mode goes further (98.7%+) but requires sandboxing infrastructure — keep that in mind as a v2 strategy.

### 4.8 Fan-Out Semantics

Standard verbs that fan out across multiple connectors use these semantics, configurable per-deployment via DB config (admin-tunable, not hardcoded):

- **Parallel:** `Promise.allSettled` (one failed connector does not abort the call)
- **Per-connector timeout:** `AbortController`-based, with configurable `timeout` and `maxTotalTimeout`
- **Partial results on failure:** Return what succeeded, mark failures in response metadata
- **Result merging:** By timestamp where applicable; deduplication policy per verb
- **Cost cap per call:** A single `logs.search` cannot exceed configured cost ceiling
- **Source attribution:** Always preserved in result items (`_source: 'datadog'`)

### 4.9 Code Patterns to Adopt (with Attribution)

From OSS projects whose licenses permit reuse with attribution:

**From MetaMCP (MIT):**
- `parseToolName` / `createToolName` utility (handles nested aggregation via first-`__` parsing rule)
- Functional middleware composition pattern (`createFunctionalMiddleware`, `compose` via `reduceRight`)
- Tools-sync hash-based change detection (skip expensive DB writes when nothing changed)
- Fan-out with `Promise.allSettled` + per-server `AbortController`
- STDIO subprocess pool design (`mcp-server-pool.ts`)
- Postgres regex constraints on names
- Tool overrides at namespace level (`override_name`, `override_description`, `override_annotations`)

**From Airis MCP Gateway (MIT):**
- Schema partitioning algorithm (port `schema_partitioning.py` to TypeScript)
- `expand_schema` meta-tool pattern

**From LangChain MCP adapters (MIT):**
- `dereferenceJsonSchema` (handles `$ref`/`$defs` from Pydantic-generated MCP servers)
- `simplifyJsonSchemaForLLM` (strips `allOf`/`anyOf`/`oneOf`/`if-then-else`/`not` that some LLMs can't consume)

**From Lunar MCPX (MIT-ish):**
- `tool-token-estimator.ts` pattern using `js-tiktoken`
- `tool-call-batcher.ts` pattern

**Build from scratch, not fork.** Forking MetaMCP was considered and rejected. Their substrate is excellent but their 1:1 endpoint-to-namespace constraint, their tech debt, and the fact that the investigation plugin touches every layer (schema, middleware, storage) mean forking creates more pain than it saves. Build cleanly, copy utilities, learn from patterns. Keep their MIT license header on any file derived from theirs.

### 4.10 Skills as First-Class Concept

The AWS Labs CloudWatch MCP server ships "Skills" — pre-built investigation playbooks like "AgentCore Investigation" — that encode multi-step investigation procedures in `SKILL.md` files. Our product is *literally about investigation*. Skills are an obvious fit. Design the data model to support this from day one (a `skills` table, a skill-loader, an `investigation__list_skills` / `investigation__run_skill` toolset), even if v0 ships with a small set. Additive to whichever architecture; not an alternative.

### 4.11 Vendor-Agnostic Tool Surface

Standard verbs: `logs.search`, `traces.search`, `errors.search`, `deploys.list`, etc. (registry grows over time). The engineer never thinks about which vendor answers the query at the standard verb level. Vendor-native tools coexist via the dual-surface model when an engineer needs vendor-specific power (e.g., `datadog__live_tail`).

### 4.12 MCP Inspector (Built-In Debugging UI)

MetaMCP ships a built-in MCP inspector for debugging tool calls during development — visible, navigable, replayable. Implementing one is small in scope (single-page app talking to a debug endpoint on the aggregator) but pays for itself in the first week of development. Every contributor PR will use it. Every "why didn't this tool call return what I expected" question becomes a 30-second investigation instead of a 30-minute one.

**Not v0 critical-path**, but build it in the first month of work. Cheap relative to the velocity it returns. Bundled in OSS — contributors and self-hosters both benefit. Can be a separate `packages/inspector` package, hosted at `/inspector` on the same Fastify server.

### 4.13 Contributor Velocity Principle

The single highest-leverage thing for community contribution is **time from `git clone` to "I made it do something."** For most OSS projects, this is 2-8 hours of pain (undocumented dependencies, broken tooling, unclear next steps). Target for this project: **30 minutes for a working local dev environment.**

This shapes downstream decisions:
- **Docker Compose first-run** — `git clone && cp .env.example .env && docker compose up` brings up Postgres, Redis, the server, and a smoke-test connector.
- **`.env.example` checked in** with sensible defaults and clear comments.
- **Single-command bootstrapping**: `pnpm install && pnpm dev` runs the development loop.
- **CONTRIBUTING.md with a "your first connector in an afternoon" walkthrough** that produces a working PR.
- **Working sample data** in `seed/` so new contributors can see real-looking sessions and tool calls without configuring vendor credentials.

Every minute of friction beyond 30 is a contributor lost. The math is brutal: if 100 developers visit the repo and 70% bounce at the install step, your effective contributor pool is 30. Move the install step from "30 minutes" to "2 hours" and that 30 becomes 5. This is *the* lever, more important than language choice, framework choice, or feature richness.

### 4.14 ConnectorContext Abstraction & Three Deployment Modes

Connector code is **mode-agnostic** — it never knows whether the subprocess runs in our cloud, on the engineer's laptop, or with credentials vended from the cloud. The runtime determines those things, swapped underneath via a single abstraction:

```typescript
// What the connector author writes (mode-agnostic)
interface Connector {
  name: string;
  capabilities: Capability[];
  logsSearch?(query: LogsSearchQuery, ctx: ConnectorContext): Promise<LogsSearchResult>;
  // ...
}

// What the runtime provides (mode-specific)
interface ConnectorContext {
  getCredentials(): Promise<Record<string, string>>;
  executeUpstream(method: string, params: unknown): Promise<unknown>;
  cache: CacheClient;
  audit(event: AuditEvent): void;
  emit(event: TelemetryEvent): void;
}
```

Three runtime implementations swap underneath:

**Mode 1 — Cloud-runs-subprocess + cloud-stored credentials (OSS default).**
- Subprocess runs in our cloud
- Credentials encrypted in cloud Postgres (master key from env var)
- Simplest setup: engineer adds a URL to their MCP client config, done
- Suits: solo developers, small teams, POC evaluations, OSS self-hosters who trust their own infrastructure (same trust model as self-hosting Sentry, GitLab, Mattermost)

**Mode 2 — Local-runs-subprocess + local credentials (OSS alternative).**
- Subprocess runs on engineer's laptop, spawned by local agent
- Credentials read from engineer's local environment (AWS profile, env vars, gh CLI tokens, etc.)
- Our cloud sees zero credentials
- Suits: security-conscious self-hosters, "we never share credentials" teams, air-gap deployments where engineers already have local vendor access

**Mode 3 — Local-runs-subprocess + cloud-vended ephemeral credentials (SaaS conversion + Enterprise self-host).**
- Subprocess runs on engineer's laptop
- Long-lived credentials stored encrypted in cloud (configured by admin once)
- Local agent requests *ephemeral* short-lived credentials from cloud on demand
- AWS: STS AssumeRole (15-min sessions)
- GCP: Workload Identity Federation (1-hour tokens)
- OAuth vendors (Sentry, GitHub): access tokens forwarded with short local cache; refresh tokens never leave cloud
- API-key vendors (Datadog, Cloudflare, etc.): static keys forwarded with very short local cache (1-2 min) and rate-limited
- Suits: companies that want centralized credential management + admin-once setup + minimized credential exposure + centralized audit and revocation. The mode security/compliance-conscious enterprises will choose.

**All three modes available in OSS.** No security feature is gated behind a paywall. The conversion driver is operational complexity (running the credential vending service correctly), not feature access. See Section 6.

**Real-world precedents for Mode 3:** AWS IAM Identity Center, HashiCorp Vault dynamic secrets, Kubernetes ServiceAccount tokens, GitHub Actions OIDC. Same pattern: central authority manages long-lived credentials, distributes ephemeral ones on demand, work happens at the edge.

### 4.15 Authentication: LLM Client → Aggregator (Auth #1)

This identifies *which engineer* is making each request. Critical for session ownership, audit, cost attribution, and RBAC.

**OAuth 2.1 is the primary auth method.** Required by Claude clients (Claude Code, Claude Web) which do not support static API keys for remote MCP servers. The protocol flow:

1. MCP client hits `/mcp` → server returns `401 Unauthorized` with `WWW-Authenticate: Bearer resource_metadata="..."` header (RFC 9728)
2. Client discovers our authorization server via `/.well-known/oauth-protected-resource`
3. Client registers itself via Dynamic Client Registration (DCR primary, Client ID Metadata Document forward-looking but not yet shipped by major clients)
4. User authorizes via browser flow
5. Token issued with PKCE (mandatory per Nov 2025 spec revision)
6. Subsequent requests include `Authorization: Bearer <token>`

**MCP spec evolution worth noting:**
- March 2025: OAuth 2.1 standardized in the spec
- June 2025: MCP servers split from authorization servers; RFC 9728 required
- November 2025: CIMD added as preferred registration method; PKCE non-negotiable
- April 2026: OAuth incremental scope consent added; spec now governed by Linux Foundation's Agentic AI Foundation

**API keys are the secondary auth method**, for cases where OAuth doesn't fit:
- Slack bot (service-to-service, no browser flow)
- CI scripts and automation
- Local development tooling
- Long-lived service accounts

Same Fastify auth middleware handles both: API key check first (if header looks like a long-lived key), bearer token validation otherwise. Both resolve to a user identity that gets attached to the request context.

**Implementation: `packages/auth/` as a publishable workspace package.**

Built from day one as if it were a public npm package, but kept private until the coordinated OSS launch. Pattern modeled on `@auth/drizzle-adapter`, `@auth/prisma-adapter` — focused integration packages that fill a specific gap in the ecosystem.

What it integrates:
- `@modelcontextprotocol/sdk`'s built-in `mcpAuthRouter` (protocol-level RFC compliance)
- Possibly `wille/mcp-oauth-server` as a thin wrapper (pluggable storage, MIT licensed, MCP-spec-focused)
- Better Auth for user accounts, sessions, API keys, and (eventually) SSO/SAML
- Drizzle + Postgres for storage

What it does NOT do:
- Reimplement OAuth 2.1 from scratch
- Compete with `wille/mcp-oauth-server`, `@tmcp/auth`, `mcp-framework`, `@ory/mcp-oauth-provider`
- Add new MCP protocol features

License: Apache 2.0 or MIT (frictionless community adoption, same as connector SDK and future plugin SDK).

Coordinated launch with the main project's OSS launch — battle-tested in our own product first, then published when stable, marketed alongside the main project for compound credibility.

### 4.16 Authentication: Aggregator → Vendor MCPs (Auth #2)

This is about how *our aggregator* (Mode 1) or *the local agent* (Mode 2/3) authenticates to vendor MCP servers. Completely separate concern from Auth #1.

**Three vendor auth patterns exist; each connector declares which it supports:**

**Pattern A — Static service credentials** (AWS keys, Datadog API keys, Stripe secret keys, PagerDuty tokens, Cloudflare tokens):
- Admin generates a credential representing a service identity at the vendor (an IAM user, an API key tied to no specific human)
- All team members use the same credential
- No OAuth flow involved
- Team-shared scoping is the only meaningful option

**Pattern B — Service-account-style integration via OAuth** (Sentry Internal Integration, GitHub App installation, Slack Bot User OAuth):
- Admin clicks through an OAuth flow, but the resulting token represents the *integration* (a service identity at the vendor), not the admin who installed it
- If the admin leaves, the integration token keeps working
- All team members share the token
- This is the *right* default for SRE investigation tooling

**Pattern C — Per-user OAuth** (Sentry user OAuth, GitHub user OAuth):
- Each engineer authenticates individually
- Token represents their personal vendor access
- Different engineers might see different data based on personal vendor permissions
- Required by some vendors (rare for SRE tooling)
- Off by default; available as an opt-in for the specific connectors and orgs that need it

**Default for our product: Pattern A or B (team-shared service-account-style).** Engineers investigating an incident shouldn't need personal vendor accounts. They have access to *our product*; *our product* uses team-level service credentials to query vendors. This is how every observability platform already works.

**Vendor → Pattern mapping (v0 connectors):**

| Vendor | Pattern | Mechanism |
|---|---|---|
| AWS CloudWatch | A | IAM user/role keys |
| GCP Observability | A | Service account JSON |
| Sentry | B | Internal Integration token |
| GitHub | B | GitHub App installation |
| PagerDuty | A | REST API token |
| Datadog | A | API key + App key |
| Cloudflare | A | API token |
| Slack | B | Bot User OAuth (per workspace) |

**Credential schema supports both team-shared and per-user:**

```sql
CREATE TABLE connector_credentials (
  id                UUID PRIMARY KEY,
  team_id           UUID NOT NULL REFERENCES teams(id),
  user_id           UUID REFERENCES users(id),       -- NULL = team-shared
  connector_name    TEXT NOT NULL,
  provider_type     TEXT NOT NULL,                   -- 'static_env' | 'integration_oauth' | 'user_oauth'
  scope_type        TEXT NOT NULL,                   -- 'team_shared' | 'per_user'
  initiated_by_user_id UUID REFERENCES users(id),    -- Who set this up (for audit)
  encrypted_payload BYTEA NOT NULL,
  metadata          JSONB,
  expires_at        TIMESTAMPTZ,
  rotated_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT scope_consistency CHECK (
    (scope_type = 'team_shared' AND user_id IS NULL) OR
    (scope_type = 'per_user'   AND user_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX ON connector_credentials (team_id, connector_name) 
  WHERE scope_type = 'team_shared';
CREATE UNIQUE INDEX ON connector_credentials (team_id, user_id, connector_name) 
  WHERE scope_type = 'per_user';
```

**Each connector declares its supported patterns in `ConnectorMeta`:**

```typescript
export const sentryConnectorMeta: ConnectorMeta = {
  name: 'sentry',
  authPatterns: {
    primary: 'integration_oauth',
    fallback: 'static_env',
    perUser: false,
  },
  oauth: {
    authorizationUrl: 'https://sentry.io/oauth/authorize/',
    tokenUrl: 'https://sentry.io/oauth/token/',
    scopes: ['org:read', 'event:read', 'project:read'],
    integrationFlow: true,
  },
  envVarName: 'SENTRY_AUTH_TOKEN',
  credentialVending: {                        // Used in Mode 3
    strategy: 'oauth_access_token_forward',
    localCacheTTLSeconds: 300,
    refreshThresholdSeconds: 30,
  },
};
```

**Per-vendor Mode 3 vending strategies:**

- **AWS:** `sts:AssumeRole`, 15-min sessions. Excellent ephemeral support.
- **GCP:** Workload Identity Federation, 1-hour tokens. Good ephemeral support.
- **OAuth vendors (Sentry, GitHub, Slack):** Forward access token with short local cache (5-10 min); refresh tokens stay in cloud and never sent to local agent.
- **API-key vendors (Datadog, Cloudflare, Stripe, PagerDuty):** Forward static API key with very short local cache (1-2 min) and per-engineer rate limits. Less clean than AWS-style but still better than long-lived keys on every laptop.

**Identity is tracked in three distinct places:**

| Where | What it answers | Lifecycle |
|---|---|---|
| `connector_credentials.initiated_by_user_id` | "Who set up this integration?" | Once, at integration setup |
| `audit_log.user_id` | "Who triggered this tool call?" | Every call |
| `session_events.user_id` | "Who ran this step in the investigation?" | Every event in a session |

The subprocess never sees individual engineer identity. It uses team service credentials. Vendor-side audit (CloudTrail, Sentry audit log) shows "team service identity made N calls"; our audit log shows "engineer alice triggered N tool calls."

### 4.17 Subprocess Pool Semantics

**Pool key: `{team_id, connector_name}`** (not per-user, not global). One subprocess serves all engineers on a team for a given connector — they share the team's service credentials, so the subprocess is shareable.

**Concurrent in-flight requests are multiplexed via JSON-RPC `id`**, not serialized in our aggregator. MCP/JSON-RPC supports multiple in-flight requests on a single connection; the MCP SDK handles request/response correlation natively. When Alice fires `logs.search` (fans out to 3 connectors) and Bob fires `traces.search` 200ms later (fans out to 2), neither waits for the other — Datadog and Sentry subprocesses serve both engineers' requests concurrently, the aggregator multiplexes by `id`, responses are routed to the right caller as they come back.

**Whether the subprocess actually parallelizes work depends on the upstream MCP server's internal implementation.** Most modern MCP servers are internally async/concurrent (AWS Labs Python uses asyncio, GCP/Sentry/GitHub use Node.js event loop or goroutines). Some older or simpler ones may serialize internally — they still accept multiple in-flight requests but process them in order. From our aggregator's perspective this is transparent; we just await responses by `id`.

**Per-subprocess concurrency cap.** Default 16-32 in-flight requests, admin-configurable. Beyond cap:
- v0/v1: queue internally with backpressure; log warning if queue depth grows
- v2: pool can scale up to N subprocesses per `{team_id, connector_name}` and route by available capacity

**Three cases that trigger a new subprocess spawn:**

1. Concurrency cap exceeded — spawn additional subprocess for that `{team_id, connector_name}`
2. Per-user credentials configured (rare) — Alice and Bob need different env vars, can't share
3. Health/restart cycle — subprocess crashed or hung, replace it

**Where the pool lives:**
- Mode 1: In the cloud aggregator
- Mode 2 and Mode 3: On the engineer's laptop, managed by `@parallax/agent`

Same pool semantics regardless of location.

### 4.18 Phased Implementation: Mode 1 → Mode 2 → Mode 3

The architecture supports all three modes from day one (via `ConnectorContext`), but the modes are *shipped* progressively to manage scope:

**Phase 1 — Mode 1 only (v0)**
- Cloud server: Fastify + MCP SDK Streamable HTTP, Postgres, Redis
- Connector adapters (all in the cloud)
- Subprocess pool (in the cloud)
- Investigation plugin (sessions, correlation, postmortem)
- Standard verb routing, schema partitioning, middleware
- Auth #1: OAuth 2.1 + API keys
- Auth #2: credentials encrypted in cloud Postgres
- **No local package.** Engineers add a URL to their MCP client config.
- This is what ships to the first design partner.

**Phase 2 — Add `@parallax/agent` local package + Mode 2**
- New npx-installable local agent
- Acts as local MCP server (LLM client spawns it via stdio)
- Talks to cloud for sessions/correlation/audit/cache
- Spawns vendor MCP subprocesses locally
- Reads local credentials (AWS profile, env vars, gh tokens)
- Cloud server gains: ability to accept results forwarded from local agents; cache becomes local L1 + cloud L2
- Security-conscious self-hosters and "we never share credentials" deployments can opt in.

**Phase 3 — Add credential vault + vending + Mode 3**
- New cloud services: credential vault, credential vending endpoint
- Per-vendor vending implementations: STS, Workload Identity, OAuth refresh, API key forwarding with cache
- Local agent gains: credential request logic, ephemeral cache, refresh
- Audit log of every vending event
- This is the SaaS conversion point — most security-conscious teams will choose managed Mode 3 over running the vending service themselves.

**Critical architectural discipline from Phase 1:** Even though only `CloudRuntime` ships in Phase 1, the `ConnectorContext` abstraction must be present from the first commit. Connectors written to the abstraction can be reused unchanged in Phases 2 and 3. Skip the abstraction and Phase 2 becomes a refactor of every connector — expensive and avoidable.

**Why the local package doesn't exist in Mode 1:** In Mode 1, the cloud server is itself a remote MCP server speaking Streamable HTTP. LLM clients (Cursor, Claude Code, Windsurf, etc.) know how to connect to remote MCP servers directly. Adding a local package would create install friction with no architectural benefit — Mode 1's appeal is "add a URL, done." The local package only exists when subprocesses need to run locally (Phase 2 onward).

### 4.19 MCP Client Compatibility

The architecture works with any MCP-compliant client — 300+ clients exist as of 2026. The protocol is governed by the Linux Foundation's Agentic AI Foundation (donated December 2025). What differs across clients is configuration shape and OAuth flow specifics, not the protocol on the wire.

**Major client categories worth explicitly supporting in docs:**

*IDE / coding-agent clients:*
- Cursor (OAuth-first since v1.0, June 2025; `~/.cursor/mcp.json`)
- Claude Code (Anthropic CLI; built-in `/mcp auth` command)
- Claude Desktop, Claude Web (native)
- Windsurf (Codeium; MCP-native from launch; `~/.codeium/windsurf/mcp_config.json`)
- Google Antigravity (agent-first IDE built on VS Code, launched November 2025; default Gemini 3 Pro but toggles between Claude Sonnet 4.5 and GPT-OSS 120B per task; native MCP)
- VS Code + GitHub Copilot (added 2026)
- Zed (built-in, but `context_servers` URL form doesn't support HTTP headers — engineers use `npx mcp-remote` as a header-injecting shim, or pure OAuth without headers)
- JetBrains AI Assistant
- Cline + forks (Roo Code, Kilo Code)
- Continue.dev
- Sourcegraph Cody
- Replit
- Codex CLI / Codex app (OpenAI; experimental flag dropped, now standard)

*OpenAI surface:*
- ChatGPT — added MCP support April 2025 via Apps SDK + Connectors; *requires enabling Developer Mode toggle*; available on Plus/Pro/Business/Enterprise/Education plans only (not free)
- OpenAI Agents SDK (full MCP support)

*Google surface:*
- Gemini API + Vertex AI Agent Builder (March 2026)

*Desktop chat / multi-agent:*
- LibreChat, LM Studio, Cherry Studio, Goose (Block), Raycast, Nimbalyst

*Others:*
- Vercel AI SDK, Devin, Factory, v0, Mastra AI, LangChain, LlamaIndex, CrewAI

**Operational notes:**
- ChatGPT Free, Claude.ai Free, and Cursor Free *cannot add custom MCP servers*. Paid plans only. Our user base is implicitly "engineers on paid AI tool plans," which is fine for the target market but worth noting.
- Most clients route through OAuth on first connection in 2026. If a client still asks for a pasted static token, that client is behind the spec.
- Configuration JSON shapes differ slightly per client; bundle setup snippets for each major client in `docs/install/`.
- Antigravity is particularly interesting for our use case because engineers can toggle the underlying model per task — useful for choosing the right model per investigation step.

**What this means for our docs:** Maintain a `docs/install/` directory with one page per client (Cursor, Claude Code, Claude Desktop, Windsurf, Antigravity, ChatGPT, VS Code, Zed, Codex CLI, etc.), each with copy-pasteable config snippets. Pattern works well at sites like mcpbundles.com that maintain similar matrices.

---
