# Overview — What This Is & What's Changed

> Part of the **Parallax** project context. Last updated May 2026. See `README.md` for the full file index.
>
> **What's in this file:** **Start here.** Master overview of the project — what it is, the problem it solves, what's genuinely new, and the running log of locked decisions. Paste this file into a new AI conversation as your context primer.

---

# Parallax — Master Project Context

> **Purpose:** Paste this file into any new conversation (Claude, Cursor, Claude Code, or any agent) to get full context on this project without repeating yourself. Keep it updated as decisions are made.

> **Last updated:** May 2026 — major revision after market validation, OSS/SaaS strategy session, autonomous-vs-human-led positioning analysis, and competitive landscape re-check against current 2026 reality. Minor revision sharpening positioning (three-layer mental model), reframing cost attribution as session metadata, recasting MCP gateways as complements not competitors, and adding the OSS launch sequence playbook. **Technical architecture lock-in session (May 2026):** added complete tech stack, storage decisions, connector model, tool naming, plugin architecture, and code-pattern references after detailed review of MetaMCP, MCPX, MCPJungle, Airis, and LangChain MCP adapters. **Technical addenda (May 2026):** added L1 cache pattern (Section 4.3), self-reference protection (Section 4.5), MCP inspector recommendation (Section 4.12), and contributor velocity principle (Section 4.13). **Auth & credentials architecture session (May 2026):** locked three-mode credential architecture (cloud-runs, local-runs + local creds, local-runs + cloud-vended), `ConnectorContext` abstraction, phased rollout (Mode 1 → Mode 2 → Mode 3), MCP OAuth 2.1 for client auth, team-shared service-account default for vendor auth, packages/auth/ as a publishable workspace package, refined SaaS conversion model (operational moat, not feature gating), broader MCP client compatibility surface. **Strategic locks (May 2026):** locked FSL-1.1-Apache-2.0 for core (Sentry-style), locked co-founder commitment (pause other products, full focus on Parallax), acknowledged platform framing (lead with investigation publicly, broader framing later).

---


## 0. What Changed in This Revision

This revision incorporates several material updates from the previous version. Read this section first if you've seen an earlier version of the doc.

1. **Competitive landscape rewritten.** The previous claim that "the cross-vendor investigation layer is structurally empty" is no longer true as of 2026. AWS DevOps Agent, Microsoft Azure SRE Agent, and multiple OSS MCP gateways (MCPX, MCPJungle, Microsoft MCP Gateway, Obot, Docker MCP Gateway, IBM ContextForge, Bifrost) now occupy the generic gateway substrate. Section 8 has been fully rewritten.

2. **Wedge re-framed.** Generic MCP aggregation is now commodity. The defensible wedge is the **investigation workflow layer** built on top of MCP gateways — Investigation Sessions, cross-vendor correlation primitive, incident-keyed replay, cost transparency per investigation. Sections 1, 2, and 3 updated to reflect this.

3. **OSS/SaaS tier strategy clarified.** Operating principle is now "monetize the operational moat, not features." Shared Investigation Sessions move into OSS (not paywalled). SSO/SAML move into SaaS tier (not Enterprise-only). Enterprise connectors to expensive enterprise systems (Splunk, ServiceNow, Dynatrace) become a real paid axis. Section 6 fully rewritten.

4. **License decision narrowed.** Apache 2.0 ruled out due to cloud-vendor relicensing risk (Elastic, HashiCorp cautionary tales). FSL (Functional Source License, used by Sentry) or BSL (Business Source License) are the active candidates for the core. License split refined in technical architecture lock-in: connector SDK and (future) plugin SDK are Apache/MIT to avoid friction for community contribution. See Section 4.7.

5. **Human-led positioning validated as mainstream, not contrarian.** The "human + LLM" approach is the dominant framework for AI SRE in 2026 (Rootly's "graded autonomy" model: Read-Only → Advised → Approved → Autonomous). Cleric, Resolve, Traversal target full autonomy; this product targets the Read-Only/Advised end of the spectrum, which is where most teams will operate for the next 18+ months.

6. **Decision NOT to pivot to autonomous RCA confirmed.** The autonomous RCA category is crowded and well-capitalized (Cleric raised $9.8M total seed in Dec 2025, Resolve.ai reached unicorn valuation Dec 2025, Traversal has Columbia/Cornell ML pedigree, plus AWS DevOps Agent and Azure SRE Agent from hyperscalers). The investigation-workflow lane is more defensible for a small team without warm Tier-1 investor relationships.

7. **Validation playbook updated.** Target is 10-15 SRE conversations, not 5, to yield 5-8 signal-quality interviews after filtering for buyer profile fit.

8. **Operational moat thesis added.** Section 6.5 now explicitly addresses what the moat needs to become and why it's deferred at ideation stage.

### Minor revision additions

9. **Positioning sharpened to a three-layer mental model.** Section 1 now explicitly frames this product as the *third thing* between MCP gateways (substrate, below us) and autonomous AI SRE agents (replacement, above us). The product is neither.

10. **MCP gateways recast as complements, not competitors.** Section 8 previously listed MCPX/MCPJungle/etc. as "direct competitors in the same lane." They are not — they sit one architectural layer below this product and their commoditization helps adoption, not hurts it.

11. **Cost attribution reframed as session metadata.** Section 3 point 5 was incorrectly suggesting the engineer sees cost mid-incident. They don't and shouldn't. Cost attribution exists for management dashboards, post-incident retros, and buyer conversations — not in-incident UX.

12. **OSS launch sequence playbook added.** New Section 12.5 covers the sequenced launch (internal → SRE community → warm intros → blog post → HN → sustained content) and the anti-patterns to avoid. Active promotion creates the surface area for organic signal to emerge.

### Technical architecture lock-in additions (most recent)

13. **Tech stack locked.** TypeScript on Node.js 22 LTS, Fastify hosting the MCP SDK, Drizzle ORM with Postgres 16 (no SQLite fallback), Redis 7.x (no in-process fallback), pnpm workspaces monorepo, Vitest, tsup, Biome (or ESLint+Prettier), Better Auth. Decisions arrived at after dedicated technical sessions and code-level review of comparable OSS projects. See Section 4.

14. **Architectural pattern: substrate + plugin.** Build the MCP aggregator/connector substrate as the core; build the investigation workflow as the *first plugin* in its own package. Design for plugins, ship one. Plugin SDK is not formally extracted yet — happens when plugin #2 arrives. Models how Backstage, Grafana, Sentry, and WordPress built their platforms. See Section 4.6.

15. **Connector model: hybrid, MCP-backed default.** Connectors are first-party npm packages implementing a standard verb interface. *Default implementation* wraps a vendor's official MCP server (AWS Labs CloudWatch, GCP Observability, Sentry, GitHub, Cloudflare, Stripe — all of which now ship official MCP servers). *Fallback implementation* uses the vendor's SDK directly for vendors without MCP servers. Maintenance burden shifts to vendors; we compete on workflow layer, not connector quality. See Section 4.5.

16. **Tool naming locked.** `<connector>__<tool>` with double underscore separator. MCP spec mandates regex `^[a-zA-Z0-9_-]{1,64}$` (no dots, no colons). Convention is now universal across MetaMCP, MCPJungle, Docker MCP Gateway, LangChain MCP adapters, and Claude Agent SDK. See Section 4.4.

17. **Schema partitioning as v0 default.** Airis-style top-level-only schemas on `tools/list` with an `expand_schema` meta-tool to retrieve full schemas on demand. Critical token-reduction strategy — non-optional given 100+ tools across 5+ MCP-backed connectors. ~200 lines to port from Airis's Python to TypeScript. See Section 4.8.

18. **Build from scratch, not fork.** Forking MetaMCP was considered and rejected — the substrate concerns we share are valuable to copy but the investigation plugin would require touching every part of MetaMCP's code. Build cleanly with attribution to the patterns we learn from. See Section 4.9.

19. **Functional middleware composition pattern as the spine.** `(handler) => handler` composed via `reduceRight`. Used for redaction, correlation, cost tracking, cache, observability, audit, schema partitioning. Pattern adopted directly from MetaMCP. See Section 4.3.

20. **STDIO subprocess pool required infrastructure.** Most vendor MCP servers are STDIO-only (subprocess via uvx/npx). The aggregator must manage subprocess lifecycle with idle pre-warming, cleanup, and max-connection caps. Pattern modeled on MetaMCP's `mcp-server-pool.ts`. See Section 4.5.

### Technical addenda (most recent)

21. **In-process L1 cache for hot DB lookups.** Short-TTL (1s) cache in front of Postgres for hot middleware reads (tool status, RBAC, namespace resolution). Pattern from MetaMCP's `ToolStatusCache`. Sits below the Redis cross-engineer cache; deduplicates lookups inside a single fan-out. See Section 4.3.

22. **Self-reference detection for nested aggregator scenarios.** Connector loader checks if a registered upstream MCP server resolves back to the aggregator itself (chained-gateway loops). Pattern from MetaMCP. See Section 4.5.

23. **MCP inspector built-in early.** Built-in debugging UI for tool calls (MetaMCP pattern). Development velocity multiplier — every contributor PR will use it. Not v0 critical-path, but first-month build. See Section 4.12.

24. **Contributor velocity principle: 30 minutes from `git clone` to working dev environment.** Shapes downstream decisions about Docker Compose, `.env.example`, single-command bootstrapping, CONTRIBUTING.md. Every minute of friction beyond 30 is a contributor lost. See Section 4.13.

### Auth & credentials architecture additions (most recent)

25. **Three-mode credential architecture.** Architecture supports three deployment modes via a `ConnectorContext` abstraction: Mode 1 (cloud-runs-subprocess, cloud-stored credentials), Mode 2 (local-runs-subprocess, engineer's local credentials), Mode 3 (local-runs-subprocess, cloud-vended ephemeral credentials). Connector code is mode-agnostic; the runtime swaps underneath. All three modes are available in OSS. See Section 4.14.

26. **Phased implementation order locked.** Phase 1 ships Mode 1 only (no local package). Phase 2 adds the local agent package and Mode 2. Phase 3 adds the credential vault + vending service for Mode 3. The `ConnectorContext` abstraction is in place from Phase 1 so Phase 2/3 are additions, not rewrites. See Section 4.18.

27. **Local agent package only exists from Phase 2.** In Mode 1, LLM clients connect directly to the cloud server via Streamable HTTP — no local install required. The local agent (`@parallax/agent`, npx-installed) is introduced only when subprocesses need to run on the engineer's machine. Keeps Mode 1's install experience to "add a URL to your MCP client config." See Section 4.18.

28. **Authentication #1 locked: OAuth 2.1 primary, API keys secondary.** Required by Claude clients (which don't support static API keys for remote MCP servers). Cursor/Claude Code/Claude Web/most modern MCP clients expect OAuth 2.1 with PKCE, DCR, and RFC 9728 protected-resource metadata. API keys retained for service-to-service cases (Slack bot, CI, automation). Built on `@modelcontextprotocol/sdk`'s OAuth helpers + Better Auth for user accounts. See Section 4.15.

29. **`packages/auth/` as a publishable workspace package.** A Better Auth + MCP SDK + Drizzle integration adapter, written like a publishable package from day one but kept private until coordinated with OSS launch. Apache/MIT licensed (frictionless community adoption). Fills a real gap — existing MCP auth libraries (`wille/mcp-oauth-server`, `@tmcp/auth`) don't have a clean Better Auth + Drizzle integration. Models the `@auth/drizzle-adapter` pattern. See Section 4.15.

30. **Authentication #2 locked: team-shared service-account-style is the default.** Vendor credentials represent a team service identity (Sentry Internal Integration, GitHub App installation, AWS IAM user/role, etc.), not individual engineers. All team members investigate using the same vendor identity; vendor-side audit shows the team service identity, our audit log shows the individual engineer. Per-user OAuth supported as optional secondary pattern, off by default. See Section 4.16.

31. **Identity tracked in three distinct places.** `connector_credentials.initiated_by_user_id` records who configured an integration (once). `audit_log` records per-tool-call user identity (every call). `session_events` records per-event user identity within investigation sessions. Subprocess never sees individual engineer identity. See Section 4.16.

32. **Subprocess pool keyed by `{team_id, connector_name}`.** Concurrent in-flight requests multiplexed onto the same subprocess via JSON-RPC `id` correlation — not serialized in our aggregator. Per-subprocess concurrency cap (default 16-32, admin-configurable). Additional subprocesses spawned only on cap exceeded, per-user-creds required, or health/restart cycle. Mode 1's pool lives in cloud; Mode 2/3 pools live in local agent. See Section 4.17.

33. **Business model refined: monetize operational complexity, not feature gating.** All three modes are in OSS (no security feature behind paywall). Mode 1 is the OSS default. SaaS sells *managed Mode 3* — we operate the credential vault and vending service so customers don't have to. Enterprise tier offers Mode 3 self-hosted with our reference implementation for air-gap deployments. Marketing language: "we run the complexity for you," not "you need to pay for this feature." See Section 6.

34. **MCP client compatibility surface is broad, not narrow.** The architecture works with any MCP-compliant client — 300+ as of 2026 — not just Cursor and Claude Code. Major clients verified: Cursor, Claude Code, Claude Desktop, Claude Web, Windsurf, Google Antigravity, ChatGPT (with Developer Mode toggle, paid plans only), VS Code + GitHub Copilot, Zed (with `mcp-remote` shim for header support), Codex CLI, Gemini API, Vertex AI Agent Builder, Cline + forks, Continue.dev, Sourcegraph Cody, JetBrains AI Assistant, LM Studio, Cherry Studio, Goose, Nimbalyst, Replit. Documentation must include setup snippets for each client. See Section 4.19.

### Strategic locks (most recent)

35. **License locked: FSL-1.1-Apache-2.0.** Sentry's "Functional Source License with 2-year Apache 2.0 conversion" for core and first-party plugins. Connector SDK and `packages/auth/` remain Apache/MIT. Honest framing: FSL is a soft deterrent and legal hook, not technical enforcement — the kinds of violations it prevents (competing commercial SaaS) are inherently public. See Section 6 (License Decision).


36. **Co-founder commitment locked.** Ship one of the other products (nearly done), then both other products pause; full focus on Parallax. **Architecture-first discipline:** lock all major architectural decisions before implementation begins so implementation is execution plus small details.


37. **Platform framing acknowledged but deferred publicly.** Architecturally, the substrate + plugin model already supports the project as a plugin platform with investigation as the *first composition*. Future plugins (infrastructure diagrams, cost optimization, deployment intelligence, security audit, etc.) compose on the same substrate. Public positioning leads with the investigation product through v0/v1; broader platform framing surfaces only once plugin #2 ships. Naming must accommodate this — product name should be substrate-neutral, not investigation-specific.

38. **Product name locked: Parallax.** Chosen against the criteria set in the naming session (substrate-neutral, protocol-free, pronounceable, memorable, no collision with existing developer tools). The metaphor is the cross-vendor correlation primitive itself: two viewpoints on the same object are what let you compute its true position — exactly what correlating one incident across several vendor stacks does. Deliberately carries no "incident," "investigation," or "MCP" in the name, so it survives both the platform reframing (plugin #2 onward) and any future shift away from MCP as the transport. **Namespace notes:** the bare npm package `parallax` is a squatted v0.0.0 placeholder (untouched since June 2022) and is unavailable; the **`@parallax` npm scope is free** and is what the pnpm monorepo actually needs (`@parallax/core`, `@parallax/connector-sdk`, `@parallax/auth`). The GitHub org `parallax` is taken, so the repo lives under a personal or alternate org namespace. Domain and trademark checks still outstanding.

---

## 1. The Product in One Paragraph

A read-only **investigation workflow layer** that sits between the engineer's LLM client (Cursor, Claude Code, Claude Desktop, Claude Web, Windsurf, Google Antigravity, ChatGPT, VS Code + Copilot, Zed, Codex CLI, JetBrains AI Assistant, Slack bot — any MCP-compliant client) and their MCP gateway / vendor MCP servers. Engineers investigate production incidents conversationally — regardless of their specific vendor stack. The product is **not** the MCP gateway (that's now commodity) and **not** an autonomous agent (Cleric, AWS DevOps Agent territory). It is a third thing: workflow primitives no generic gateway provides and no autonomous agent serves well — incident-keyed **Investigation Sessions** that record every tool call as a replayable artifact, a cross-vendor **correlation primitive** that augments each response with signals from other vendors in the same time window, **live Slack feed** for incident commanders, **per-investigation cost attribution** as session metadata, and **auto-generated postmortem skeletons** on session close.

### The three-layer mental model

- **Layer below us:** MCP gateways (MCPX, MCPJungle, Docker MCP Gateway, etc.). Substrate. Commodity. Complements, not competitors.
- **This product:** Investigation workflow layer. Sessions, correlation, replay, postmortem skeleton. The structurally empty lane.
- **Alternative path (not a layer above, a different bet):** Autonomous AI SRE agents (Cleric, Resolve, Traversal, AWS DevOps Agent). They replace the engineer in the investigation. We augment the engineer. Different bet on where reliability of LLM-driven SRE work lives in 2026-2027.

**Architectural realization (post technical lock-in):** The substrate (MCP aggregation, connector adapters, normalization, schema partitioning, middleware framework) is built as a generic core. The investigation workflow is the *first plugin* on top of that core. This means the same codebase can host future workflow plugins (deployment intelligence, cost optimization, compliance, security) without rewriting the substrate. The investigation plugin ships bundled and enabled by default — most users never know plugin architecture exists. See Section 4.6.

**Core principle:** Works with any tool that has a connector or exposes an MCP server. Adapters are added incrementally based on design partner demand. No vendor lock-in on either side.

**Positioning vs. autonomous AI SRE agents:** Designed for human-led investigation augmented by LLMs, not autonomous agents that close incidents without humans. This is the Read-Only/Advised end of the industry's graded-autonomy spectrum — where most engineering teams will operate for the next 18+ months as trust in autonomous remediation is slowly built.

**Positioning vs. MCP gateways:** Not competitive. Gateways sit one architectural layer below this product. Users with an existing gateway add this on top; users without one use the bundled minimal gateway. Substrate commoditization helps us — it normalizes the habit of running infrastructure between LLM clients and vendor MCPs, which is the on-ramp to our workflow layer.

---

## 2. The Problem

Investigating a production incident at any company with 3+ observability vendors means tab-hopping across APM tools, error trackers, log platforms, cloud consoles, and source control — copying timestamps and commit SHAs by hand, rebuilding the same correlation work every incident, losing all of it when the incident closes. Postmortems get written and then forgotten. The next time the same kind of incident happens, the team starts from zero.

**The honest wedge as of 2026:** The vendor-AI silo problem is real but partially solved (AWS DevOps Agent, Azure SRE Agent now cross-vendor). The MCP-gateway substrate problem is also solved (multiple OSS and commercial gateways exist). What is *not* solved:

- **Investigation as a first-class object** — no current product treats an incident investigation as a persistent, replayable, searchable artifact tied to incident metadata. Postmortems are static text documents disconnected from the actual investigation trail.
- **Workflow for human-led investigation specifically** — most current entrants (Cleric, Resolve, Traversal, AWS DevOps Agent) are optimizing for autonomous agents. The engineer-in-the-loop experience is an afterthought.
- **Cross-vendor correlation as a primitive** — current cross-vendor agents do correlation only when explicitly prompted. No one is augmenting every response with implicit cross-vendor signal as a structural feature.
- **Cost transparency per investigation** — token spend per incident is invisible in current products.

**Why this lane stays defensible against autonomous-agent companies:** They are racing toward 80-90% autonomous resolution and treating human interaction as a fallback. They will not optimize the human investigation experience because that's not their bet. The hyperscaler agents (AWS, Microsoft) optimize for their own clouds, not vendor-neutral workflows.

---

## 3. What's Genuinely New

Generic MCP aggregation is commodity. The differentiators are workflow primitives layered on top:

1. **Investigation Sessions** — First-class persistent objects representing one investigation, keyed by `incident_id`. Every tool call recorded: caller, timestamp, args, response, cache_hit, cost. Sessions are replayable, searchable across incidents ("show me every time we investigated Kafka lag"), and connect directly to the eventual postmortem. No current product treats investigation this way.

2. **Cross-vendor correlation primitive** — Every connector response is augmented with event-count signals from other vendors in the same time window. The LLM sees correlations without being asked. Deploy in last 30 min? Spike in errors? Trace anomaly? Surfaced automatically as response metadata, not as an additional query.

3. **Shared cache, content-addressable, TTL-classified per query type** — One API key shared across the engineering team. When one engineer's investigation warms the cache, the next pays zero API cost. Solves vendor rate limits at the key level, not per engineer. Available in OSS.

4. **Live Slack feed** — When a session is open and tagged to a Slack thread, every tool call posts a one-line summary. Incident commander sees what's being investigated in real time without interrupting the investigator.

5. **Per-investigation cost attribution (session metadata, NOT in-incident UX)** — Every tool call records `cost_estimate_usd`, aggregated at the session level. This is explicitly **not** surfaced to the engineer during the incident — they don't care mid-investigation and shouldn't be distracted. It exists in three other moments: (a) management dashboards for "why did our LLM bill triple" attribution by incident, (b) post-incident retros for optimization analysis, (c) buyer conversations as a counter-position against flat-priced autonomous agents that hide their cost structure.

6. **Postmortem auto-skeleton** — On session close, generates a Notion/Confluence postmortem skeleton (timeline, evidence list, link to session replay). Replaces the disconnected-text-document problem with a living artifact tied to the investigation trail.

7. **Centralized PII redaction, audit log, basic RBAC** — At the broker layer. Available in OSS. The enterprise-grade compliance reporting on top of this substrate is the paid axis (see Section 6).

---
