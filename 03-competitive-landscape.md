# Competitive Landscape (May 2026)

> Part of the **Parallax** project context. Last updated May 2026. See `README.md` for the full file index.
>
> **What's in this file:** Honest current map of where this product sits — MCP gateways as complements (not competitors), hyperscaler agents as the biggest underweighted risk, autonomous AI SRE agents in an adjacent lane, vendor-native AI, and incident management adjacents.

---

## 8. Competitive Landscape (Updated May 2026)

The category has changed materially since the previous version of this doc. The honest current map:

### Layer below us: MCP Gateways (complements, NOT competitors)

These products sit one architectural layer below this product. They handle substrate concerns (routing, auth, RBAC, audit, PII at the wire) but do not provide investigation workflow primitives.

**OSS MCP gateways:**
- **MCPX (Lunar.dev)** — Open source, MIT license, ~4ms p99 latency, RBAC, audit. The most mature OSS gateway as of 2026. Most enterprise-shaped — sophisticated services around OAuth, permissions, throttling, tool-call batching.
- **MCPJungle** — Go, Apache-2.0, focused on aggregation and tool discovery via Tool Groups. Earlier-stage, simpler architecture (one proxy MCP server per tool group).
- **Microsoft MCP Gateway** — OSS, Kubernetes-native, designed for Azure.
- **Docker MCP Gateway** — OSS, for Docker-native teams. Historically used `:` separator, migrated to `__` after breakage.
- **IBM ContextForge** — OSS, federation across regions.
- **Obot** — OSS, Kubernetes-native with egress policies.
- **Bifrost (Maxim AI)** — OSS, written in Go, aggregates 20+ LLM providers and MCP servers. Notable for Code Mode token reduction approach.
- **MetaMCP (metatool-ai)** — MIT, TypeScript + Express 5 + Drizzle + Postgres + Better Auth + tRPC + Next.js + Turbo. The closest sibling stack-wise to what we're building (we use Fastify instead of Express, but otherwise nearly identical). Pure proxy model (no first-party connectors). Three-level hierarchy: Servers → Namespaces → Endpoints. Known limitation: 1:1 endpoint-to-namespace constraint.
- **Airis MCP Gateway** — MIT, Docker-orchestrated, Python+TS. Distinctive bet on schema partitioning for 90% token reduction.

**Commercial MCP gateways:**
- **MCP Manager** — Commercial gateway with PII detection, RBAC, audit log export to Splunk/Datadog. SOC 2.
- **Portkey, TrueFoundry, Lunar (commercial MCPX)** — Various combinations of LLM gateway + MCP gateway with compliance certifications.

**Why this is good for us, not bad:**

The substrate commoditization is **helpful, not threatening.** Three reasons:
1. Gateways normalize the habit of running infrastructure between LLM clients and vendor MCP servers — that habit is the on-ramp to our workflow layer.
2. We don't need to compete on RBAC, audit, PII redaction at the wire — gateways already commoditized those. Our engineering focuses on the workflow primitives only we provide (sessions, correlation, replay, postmortem skeleton).
3. We're not building the substrate from scratch — we're copying patterns and utility code from the gateways with attribution (Section 4.9). Saves significant engineering time.

**Real competitive pressure from the gateway space: feature creep upward.** If MetaMCP, MCPX, or another gateway starts shipping "session" or "investigation" features, the layer boundary erodes and they become real competitors. Mitigation: ship the workflow primitives faster than gateways can absorb them, build a brand around investigation specifically, and ensure OSS gateways see us as a complement they can recommend rather than a competitor they need to absorb.

**The "MetaMCP problem" specifically:** Our tech stack (TS + Drizzle + Postgres + pnpm workspaces) is nearly identical to MetaMCP's. A knowledgeable observer's first reaction will be "this is MetaMCP plus some sessions tables." Our defense must be architectural and visible from v0:
- Investigation Session table exists from migration #1
- Correlation middleware runs on every tool call from commit #1
- Postmortem skeleton tool is in the initial tool set
- Plugin architecture makes investigation a first-class component, not an add-on

### Same lane as us: nobody, yet

The investigation workflow layer — sessions as first-class persistent objects, cross-vendor correlation primitive, replay, postmortem auto-skeleton — is not occupied by any current product as of May 2026. This is the wedge.

**Risk:** This lane could be entered by either (a) an MCP gateway expanding upward into workflow features, or (b) an autonomous AI SRE agent expanding downward into human-led mode (Cleric already does this for "complex cases"). Both are plausible 12-24 months out. The defense is to be the canonical OSS product for this lane before either happens.

### Hyperscaler agents — biggest underweighted risk

**AWS DevOps Agent** (announced 2026) — Cross-vendor by design. Integrates with CloudWatch, Datadog, Dynatrace, New Relic, Splunk, Grafana, GitHub, GitLab, Azure DevOps via MCP. Includes immutable audit trails, IAM Identity Center authentication, Agent Spaces for governance. **This is most of what the original doc described as our wedge, shipped by AWS with their distribution.**

**Microsoft Azure SRE Agent** — Explicitly positions on "your observability stack spans multiple platforms... connect them via MCP." Auto-discovers tools from any MCP server, subagent architecture for vendor-specific reasoning. Same wedge, Microsoft distribution.

**Mitigation:** Both hyperscaler agents are autonomous-first (full Read-Only → Autonomous spectrum, with autonomous as the goal). Both optimize for their own clouds. Neither is vendor-neutral OSS. The vendor-neutrality and human-led workflow positioning are the structural defenses. They cannot be vendor-neutral; we can.

### Autonomous AI SRE agents

- **Cleric** — $9.8M total seed (Vertex Ventures US led, Zetta follow-on, Dec 2025). 17 employees as of Jan 2026. Gartner Cool Vendor 2025. Autonomous investigation, learns from feedback. Production at BlaBlaCar since early 2025.
- **Resolve.ai** — Reached unicorn valuation Dec 2025. Founded by Splunk founders (OpenTelemetry, Log Insight). Target: 80% autonomous resolution. Most aggressive automation goal.
- **Traversal** — Founded by Columbia/Cornell professors in causal ML. 90%+ accuracy claim. DigitalOcean reports 36K engineering hours saved/year.
- **Parity** — Sequoia-backed, autonomous AI SRE.

**Implication:** Autonomous RCA is crowded with well-capitalized incumbents. Our positioning is deliberately not autonomous. We sit at Read-Only/Advised on the graded-autonomy spectrum where most teams will spend the next 18+ months.

### Vendor-native AI

- **Datadog Bits AI** — Multi-agent first-responder system. Pulls telemetry from connected Datadog products. Still largely siloed to Datadog data, but expanding.
- **Sentry Seer** — AI within Sentry's data. Closed-source.
- **Observe AI SRE** — MCP-based. Vendor-native (Observe's own data lake).
- **OneUptime MCP Server** — Replaces full monitoring stack, exposes own data via MCP.

**Implication:** Vendor-native AI is structurally siloed by what data the vendor owns. Not direct competitors for cross-vendor investigation, but reduces the use case when a team is mostly on one vendor.

### Incident management adjacents

- **PagerDuty, Incident.io, Rootly, FireHydrant** — Manage *who responds* (alerts, escalation, on-call, IC orchestration). Not direct competitors but expanding into AI features. Rootly published the most cited "graded autonomy" framework that our positioning aligns with.

### Risk re-ranking

1. **AWS DevOps Agent + Microsoft Azure SRE Agent** — Already shipped, hyperscaler distribution. Highest structural threat. Mitigation: vendor-neutrality + OSS + human-led workflow specialization.
2. **MCP gateway feature creep upward into workflow** — MetaMCP, MCPX, et al. could start adding session/investigation features and erode the layer boundary. Mitigation: ship workflow primitives faster, build brand around investigation specifically. Not as urgent as #1, but real over a 12-24 month horizon.
3. **Autonomous RCA companies maturing into investigation workflow** — Cleric in particular acknowledges human-in-the-loop is required for complex cases. They could narrow the gap. Mitigation: be the canonical OSS for human-led investigation before they pivot.
4. **Datadog** — Bits AI hasn't moved aggressively into cross-vendor.
5. **Anthropic** — Could ship an MCP gateway as part of Claude for Enterprise. Lower than previously ranked since multiple OSS gateways already exist.

---
