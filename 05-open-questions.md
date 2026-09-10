# Open Questions & Topics Still to Explore

> Part of the **Parallax** project context. Last updated May 2026. See `README.md` for the full file index.
>
> **What's in this file:** Living list of what's still undecided, what's recently been resolved, and what topics are flagged for future focused sessions. **Most-updated file** as decisions land.

---

## 14. Open Questions (To Be Resolved)

- [ ] **Bundled gateway vs BYOG** — Bundle minimal MCP gateway or assume user brings their own. Decide after design partner conversations. (Note: with MCP-backed connector model, our aggregator IS effectively the gateway for upstream MCP servers — this question is partly resolved.)
- [ ] **Target customer profile (ICP)** — Company size, stage, geography, team size. Validate through design partner conversations.
- [ ] **Pricing details** — Per-seat vs per-investigation vs per-vendor, free tier limits, enterprise benchmarks. Dedicated session needed. Should align with managed-Mode-3 conversion narrative.
- [ ] **Build timeline (concrete dates)** — Depends on team commitment level (now resolved at full-time post the other product shipping).
- [ ] **Read-only boundary for v2** — Where does read-only end? Deliberate answer needed before v2.
- [ ] **Investigation plugin data model** — Sessions, events, correlations, participants. Drizzle schemas. Heart of the wedge — not yet designed in detail.
- [ ] **Investigation plugin MCP tool surface** — What tools exactly does it expose? Input/output shapes. ~10-15 tools likely.
- [ ] **Cross-vendor correlation primitive algorithm** — How does it actually correlate events across vendors? Time-based, pattern-based, or both? Threshold tuning?
- [ ] **Cache key strategy and TTL policy** — Concrete TTLs per query type, content-addressable hashing, invalidation rules.
- [ ] **Cost attribution algorithm** — How do we estimate `cost_estimate_usd` per tool call? Token-based, API-call-based, hybrid?
- [ ] **Slack feed implementation** — Bot token storage, message threading, retry/rate limit logic.
- [ ] **Postmortem skeleton format** — Markdown template structure, Notion/Confluence integration targets.
- [ ] **Error handling, retry, circuit breaker patterns** — When vendor APIs are down or rate-limiting.
- [ ] **Observability strategy** — How do we monitor our own server health, performance, errors? OpenTelemetry?
- [ ] **OAuth callback handling for connector setup (Section 4.16)** — The detailed flow for when an admin sets up an OAuth-based connector. State management, CSRF, redirect URL handling, encrypted token storage. Mostly HTTP plumbing on top of architecture already locked.
- [ ] **User → admin web UI auth** — When the management UI exists, what's the auth model? Better Auth handles this; specifics deferred to when the UI is built.
- [ ] **Web UI for management** — Not v0, but eventually needed. When and what does v1 of the UI look like?
- [ ] **Plugin-to-plugin auth boundaries** — If a future plugin invokes another plugin's tools, or if plugins ever get sandboxed, there's an internal auth model. Not relevant now; defer.
- [ ] **Per-user OAuth as opt-in mechanism** — Architecturally supported (Pattern C, scope_type='per_user'). The admin UX for opting a specific connector into per-user mode is undesigned. Defer to when a specific connector requires it.
- [ ] **v0 acceptance criteria** — Clear definition of "v0 is shipped when X is true." Needed to set design partner expectations.
- [ ] **Documentation strategy** — For OSS, docs are the product face. Not just install, but tutorials, examples, conceptual guides, contribution guide.
- [ ] **Vendor MCP server breakage resilience** — Vendor updates can break us. What's the version pinning / compatibility strategy?

### Recently resolved (no longer open)

- ~~Product name~~ → **Parallax locked.** Substrate-neutral and protocol-free (no "incident," "investigation," or "MCP" in the name), so it survives the platform reframing and any shift away from MCP as transport. Metaphor maps to the cross-vendor correlation primitive: multiple viewpoints on one object resolve its true position. **Namespace:** `@parallax` npm scope free (what the monorepo needs); bare `parallax` npm package is a squatted v0.0.0 placeholder from 2022; GitHub org `parallax` taken. Domain + trademark checks still outstanding.
- ~~OSS vs closed-source decision~~ → OSS-core confirmed.
- ~~Pivot to RCA agent~~ → No, stay in investigation workflow lane.
- ~~Apache 2.0 vs other licenses (for core)~~ → Apache 2.0 ruled out; FSL or BSL.
- ~~License: FSL vs BSL specifically (for core)~~ → **FSL-1.1-Apache-2.0 locked.** Connector SDK and `packages/auth/` remain Apache/MIT.
- ~~Human-led vs autonomous positioning~~ → Human-led (Read-Only/Advised on graded-autonomy spectrum); confirmed as mainstream by Rootly's framework.
- ~~Shared Sessions OSS vs SaaS~~ → OSS. Operational moat funds SaaS, not feature gating.
- ~~SSO tier placement~~ → SaaS tier, not Enterprise-only.
- ~~"Cross-vendor lane is empty"~~ → No longer true; lane has hyperscaler agents and OSS gateways. Wedge re-framed as investigation workflow layer on top.
- ~~Tech stack (language, runtime, framework, ORM, DB, cache)~~ → TypeScript / Node 22 LTS / Fastify / Drizzle / Postgres 16 / Redis 7.x.
- ~~SQLite vs Postgres for OSS~~ → Postgres only. Docker Compose for first-run.
- ~~In-process cache vs Redis~~ → Redis only.
- ~~Express vs Fastify~~ → Fastify (Express 5 acceptable alternative if team strongly prefers).
- ~~Connector pattern (in-process classes vs MCP-backed proxy)~~ → Hybrid: MCP-backed default, SDK fallback.
- ~~Tool naming convention~~ → `<connector>__<tool>` with double underscore (spec-mandated).
- ~~Fork MetaMCP vs build from scratch~~ → Build from scratch, copy patterns with attribution.
- ~~Schema partitioning timing (v0 vs v2)~~ → V0 default, non-optional.
- ~~License of connector SDK vs core~~ → Split: core FSL-1.1-Apache-2.0, SDKs Apache/MIT.
- ~~Investigation as hardcoded vs plugin~~ → First plugin in a substrate + plugin architecture.
- ~~Credential architecture: cloud-stored vs local-stored vs vended~~ → All three (Modes 1, 2, 3) supported via `ConnectorContext` abstraction. Phased rollout (Mode 1 first).
- ~~Mode 2/3 as paid features vs all modes OSS~~ → All modes in OSS. SaaS sells managed Mode 3 operating service, not access to the mode.
- ~~Local package required in Mode 1~~ → No. Mode 1 connects clients directly to cloud via Streamable HTTP. Local package only exists from Phase 2 (Mode 2 onward).
- ~~Auth #1: API keys vs OAuth 2.1~~ → OAuth 2.1 primary (required by Claude clients), API keys secondary for service-to-service. Built on MCP SDK + Better Auth via `packages/auth/`.
- ~~Build auth from scratch vs use existing libraries~~ → Use existing (`@modelcontextprotocol/sdk`'s helpers, possibly `wille/mcp-oauth-server`, Better Auth). Build `packages/auth/` as a focused integration adapter, not a from-scratch OAuth library.
- ~~Auth #2: per-user vs team-shared default~~ → Team-shared service-account-style (Pattern A or B). Per-user OAuth (Pattern C) supported as opt-in, off by default.
- ~~Subprocess pool concurrency model~~ → One subprocess per `{team_id, connector_name}` by default. Concurrent in-flight requests multiplexed via JSON-RPC `id`. Per-subprocess concurrency cap (default 16-32, configurable). Spawn additional subprocesses only on cap exceeded, per-user-creds needed, or health cycle.
- ~~MCP client coverage~~ → Architecture works with any MCP-compliant client (300+ as of 2026). Doc must include setup snippets for Cursor, Claude Code, Claude Desktop, Windsurf, Antigravity, ChatGPT (with Developer Mode caveat), VS Code, Zed (with `mcp-remote` shim note), Codex CLI, and others.
- ~~Co-founder commitment to focus on this product~~ → Locked. Other product ships, then both other products pause for Parallax focus.
- ~~Auth model details (broad strokes)~~ → Locked across Sections 4.14-4.16. Specific OAuth callback flow details remain open.

---

## 15. Topics Still to Explore

Each topic below is a dedicated session — don't mix them.

- **Target customer (ICP)** — who exactly feels this pain most acutely, how to validate, how to reach them.
- **Pricing and business model details** — per-seat vs per-investigation vs per-vendor-connected, free tier limits, enterprise benchmarks.
- **Build planning and timeline** — after team commitment is locked.
- **Marketing strategy** — OSS launch, HackerNews, developer community, content for SRE audience.
- ~~**Naming**~~ → Resolved: Parallax. Remaining: domain acquisition and a trademark search (classes 9 and 42) before the OSS launch.
- **Auth model** — client auth to our aggregator + connector auth to upstream vendors. Both have substantial design surface.
- **Web UI for management** — eventual v1 of the management UI.
- **OSS launch strategy** — GitHub strategy, documentation, contributor guide, CI, community.
- **Financial model** — revenue projections, cost structure, path to profitability.
- **Operational moat detailed design** — deferred until usage signals exist; revisit after first design partner is using it for real.
- **Plugin SDK extraction** — when plugin #2 is on the horizon, formalize the contract.

---

*This document is a living context file. Update it after every significant conversation or decision.*
