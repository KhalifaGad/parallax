# Team, Customer, Validation, & Launch

> Part of the **Parallax** project context. Last updated May 2026. See `README.md` for the full file index.
>
> **What's in this file:** Locked team-level decisions, ICP, the validation playbook, the OSS launch sequence, and the phased build timeline (Mode 1 → Mode 2 → Mode 3).

---

## 9. Team-Level Decisions

### Key Decisions Made

- ✅ Go with co-founders, not solo (psychological sustainability + build speed).
- ✅ Prioritize this product over the other two (USD revenue, fundable internationally).
- ✅ **Co-founder commitment locked:** Ship one of the other products (it's nearly done), then both other products pause; full focus on Parallax.
- ✅ **Architecture-first discipline:** Lock all major architectural decisions before implementation begins, so implementation is execution + small details only.
- ✅ Stay OSS-core, do not pivot to closed-source autonomous RCA.
- ✅ **License locked: FSL-1.1-Apache-2.0** (Sentry's "Functional Source License with 2-year Apache 2.0 conversion"). Connector SDK and `packages/auth/` remain Apache/MIT.
- ✅ Read-only for MVP and v1.
- ✅ Tech stack locked: TypeScript / Node 22 LTS / Fastify / Postgres / Redis / Drizzle.
- ✅ Substrate + plugin architecture; investigation is the first plugin.
- ✅ Connector model: MCP-backed default, SDK fallback.
- ✅ Build from scratch, copy patterns with attribution. Do not fork MetaMCP.
- ✅ Three-mode credential architecture via `ConnectorContext` abstraction (Modes 1, 2, 3).
- ✅ Phased implementation: Mode 1 first, then Mode 2, then Mode 3.
- ✅ All three modes available in OSS; SaaS sells managed Mode 3 (operational complexity, not feature gating).
- ✅ Auth #1: OAuth 2.1 primary + API keys secondary, via `packages/auth/` (publishable adapter).
- ✅ Auth #2: team-shared service-account-style as default; per-user OAuth optional/off by default.
- ✅ MCP client compatibility: broad (300+ clients), documented per-client in `docs/install/`.
- ✅ **Platform framing:** Architecture supports the project being a plugin platform with investigation as the *first composition*; future plugins (infrastructure diagrams, cost optimization, etc.) compose on the same substrate. *Public positioning leads with investigation product*; platform framing surfaces only once plugin #2 ships.
- ✅ **Product name locked: Parallax.** Substrate-neutral and protocol-free, so it survives the platform reframing. `@parallax` npm scope free; bare `parallax` package squatted; GitHub org `parallax` taken. Domain and trademark checks outstanding.

---

## 10. Target Customer Profile

> ⚠️ Not locked. Requires dedicated conversation. Notes below are early hypotheses only.

Early hypothesis: engineering teams with 3+ observability vendors, active on-call rotation, no dedicated AIOps team, no existing autonomous AI SRE deployment yet. Company size, geography, and stage are open questions to validate through design partner conversations.

**Filter for hypothesis testing:** Teams currently using AWS DevOps Agent or Azure SRE Agent are already served; teams currently using Cleric/Resolve are on the autonomous track. The target is teams not yet on either path who are doing manual cross-vendor investigation today.

---

---

## 12. Validation Playbook

### Target: 10-15 external conversations, not 5

Five raw conversations yields ~2 signal-quality interviews after filtering for buyer profile fit. Need 5-8 signal-quality interviews → 10-15 raw.

### The Script

> "Tell me about your last 1-2 week incident. Walk me through the investigation. What tools were you in? What were you copying between tabs? What did you lose when it closed?"

### Listen for

- Frustration with tab-switching and manual correlation
- "We had to brief every new person who joined the war room"
- "All that knowledge just died with the postmortem"
- Specifically: **"the loss of investigation work between incidents"** — when this comes up unprompted from multiple people, the wedge is confirmed

### Sharpest question to add

> "Has this kind of incident happened before? Did you remember anything from last time?"

Reveals whether postmortems are actually used or written-and-forgotten. If forgotten (which is usual), the Investigation Sessions value prop lands harder.

### Discipline

- Don't explain the product first.
- Don't ask "would you use a tool that..."
- Don't leak the idea — ask about the pain, not the solution.
- When they say something interesting, ask "tell me more about that" three times before pitching anything.
- The signal isn't "yes I'd use that" — it's the same complaint phrased the same way by three different people who don't know each other.

### Disqualifiers

- Already on AWS DevOps Agent or Azure SRE Agent (served).
- Already on Cleric, Resolve, Traversal (on autonomous track, not our buyer).
- Single-vendor observability (one Datadog instance) — wedge doesn't apply.
- No active on-call rotation.

---

## 12.5. OSS Launch Sequence

When and how to launch publicly. The wrong launch (too early, wrong audience) burns the first impression and you don't get a second one. This sequence is gated by readiness, not calendar.

### Sequenced launch

1. **Internal use only.** Design partner uses it on 3+ real incidents. Repo private. No external visibility. Goal: confirm the workflow actually works under real conditions and the README explains the wedge in 30 seconds to a new person.

2. **Soft launch to specific SRE / MCP communities.** Not Hacker News yet. Post in 2-3 SRE-specific Slack/Discord communities (SREcon, observability vendor Slacks, MCP community Discord). Frame as "we built this thing, looking for feedback from people who feel this pain." Goal: first 20-50 stars from people who actually care, plus direct feedback to iterate on.

3. **Personal network warm intros.** DM 30-50 SRE leads in personal and co-founder networks. Show them the repo. Don't pitch. Some will star, some will share, some become validation conversation candidates. Overlaps with Section 12 validation work.

4. **First technical blog post.** Not a launch announcement — an actual deep-dive on something hard solved. Examples: "How we built a correlation-aware cache for cross-vendor MCP investigation" or "The four hardest problems in MCP session replay." If the post is good, people who already starred share it. This is how Supabase, Plausible, Cal.com built early traction.

5. **Hacker News launch.** Only after the above. HN is brutal to underbaked launches. Required to survive scrutiny:
   - Working demo (5-minute Loom against real incident data, ideally with the design partner)
   - README that explains the wedge in 30 seconds
   - At least one real testimonial from a design partner
   - Visible contributors (so it doesn't look solo)
   - Founders ready to be online for the first 6 hours answering comments
   - A clear, prepared answer to "why not just use [Cleric / AWS DevOps Agent / MetaMCP / MCPX]" on the first comment
   
   A successful HN front-page produces 500-2000 stars in 48 hours. A failed one burns the launch and the product memory of the audience.

6. **Sustained content cadence.** One technical post a month. One product update a month. Quiet repos die. Active repos compound.

7. **Conference presence.** SREcon talks, DevOps conferences (including regional ones — MENA DevOps community is active and underserved by US-centric content). One accepted talk drives meaningful traffic and recruits design partners.

### What people actually search for

Nobody searches "Parallax" expecting this product, and nobody searches "incident MCP" or "investigation MCP" either — those terms don't exist yet. A deliberately non-descriptive name means brand-name SEO has to be *built*, not harvested; it will not carry the launch. Target intent-based searches instead:

- "datadog sentry correlation tool"
- "incident investigation with cursor"
- "open source AI SRE"
- "MCP server observability"
- "cross-vendor incident response"
- "shared cache MCP"

Also: get listed on awesome-mcp-servers, awesome-sre, awesome-observability lists. These drive meaningful traffic from people already looking.

### Anti-patterns

- **Launching on HN before design partner usage.** Brutal rejection in the first 30 minutes of comments. No second chance.
- **Launching to a general developer audience (r/programming, dev.to general) instead of SRE-specific.** Wrong audience, weak signal even if the post performs.
- **Promoting in MCP-vendor Slacks before being known there.** Looks like spam. Build relationships first by being helpful in those communities for a few weeks before mentioning the product.
- **Waiting for organic discovery without active promotion.** Organic stars are a *signal of resonance*; active promotion is what *creates the surface area* for that signal to emerge. They are not in opposition. Passive waiting is just slow failure.

---

## 13. Build Timeline

> ⚠️ Not dated. Depends on team commitment level (full-time vs part-time) and design partner availability. Sequenced by phase.

### Phase 1 — Mode 1 (v0, ships to first design partner)

1. Repository legal files: LICENSE (FSL-1.1-Apache-2.0), NOTICE, CONTRIBUTING.
2. License choice (FSL vs BSL specifically for core).
3. Repository scaffolding: pnpm workspace, `packages/core`, `packages/connector-sdk`, `packages/plugin-investigation`, `packages/auth`, `packages/cli`, Docker Compose, GitHub Actions CI.
4. Storage layer: Drizzle schemas with Postgres regex constraints, migrations, Redis client. Multi-tenant data isolation primitives in schema from day one. `connector_credentials` table with mode-agnostic schema (supports team-shared and per-user; per-record encryption with master key).
5. Substrate skeleton: Fastify + MCP SDK Streamable HTTP mount, functional middleware composition framework, plugin runtime, subprocess pool (cloud-side for Mode 1).
6. **`ConnectorContext` abstraction** — even though only `CloudRuntime` is implemented in Phase 1, the abstraction is present from the first commit so Phase 2/3 are additions, not rewrites.
7. **Auth #1: OAuth 2.1 + API keys.** `packages/auth/` built as a publishable workspace package using `@modelcontextprotocol/sdk` + Better Auth + Drizzle. Possibly `wille/mcp-oauth-server` as a thin wrapper. DCR, PKCE, RFC 9728 protected-resource metadata, 401 + WWW-Authenticate. Kept private until coordinated OSS launch.
8. **Auth #2: team-shared service-account-style as default.** Per-connector `authPatterns` declared in connector metadata. OAuth flows for Pattern B vendors (Sentry Internal Integration, GitHub App installation, Slack Bot OAuth). Static credential storage for Pattern A vendors. Per-user OAuth (Pattern C) wired but off by default.
9. Tool name parser (port from MetaMCP), schema partitioning middleware (port from Airis), schema normalization middleware (port from LangChain), `expand_schema` meta-tool.
10. First connector triple — based on design partner stack. Likely GitHub + Sentry + (CloudWatch or GCP Observability). All MCP-backed via Implementation A. Written against `ConnectorContext`.
11. Investigation plugin v0: Sessions schema, correlation middleware, basic postmortem skeleton, session replay tool. Tools: `investigation__create_session`, `investigation__close_session`, `investigation__join_session`, `investigation__list_open_sessions`, `investigation__replay`, `investigation__search_sessions`.
12. Documentation: `docs/install/` with setup snippets for Cursor, Claude Code, Claude Desktop, Windsurf, ChatGPT, VS Code, Antigravity, Zed (with shim note), Codex CLI.
13. Internal use by design partner on real incidents (private repo).
14. 10-15 validation conversations in parallel.

### Phase 2 — Local agent + Mode 2

15. Build `@parallax/agent` local package (npx-installable).
16. Implement `LocalRuntime` (Mode 2): local subprocess pool, local credential reading (AWS profile, env vars, gh tokens, GCP ADC).
17. Cloud server changes to accept "results forwarded from local agent" requests.
18. Cache becomes hierarchy: local L1 + cloud L2.
19. Documentation update for local agent install path.
20. Security-conscious self-hosters opt in.

### Phase 3 — Credential vault + vending + Mode 3

21. Cloud credential vault (per-team service credentials, encrypted at rest with master key).
22. Credential vending endpoint: per-vendor implementations (STS AssumeRole, GCP Workload Identity, OAuth token forwarding with refresh, API key forwarding with short cache).
23. `VendedCredsRuntime` in local agent: credential request logic, ephemeral cache, automatic refresh.
24. Audit log of every vending event.
25. SaaS billing integration.
26. Hardening + connector additions based on design partner feedback.
27. Public OSS launch (only after design partner is using it for real incidents — per Section 12.5).
28. Fundraise conversation prep.

**Critical discipline across phases:** The `ConnectorContext` abstraction is in Phase 1. Connector code is mode-agnostic. Phases 2 and 3 add new runtimes, not rewrites of existing code.

---
