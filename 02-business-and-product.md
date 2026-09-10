# Business Model, Operational Moat, & Product Scope

> Part of the **Parallax** project context. Last updated May 2026. See `README.md` for the full file index.
>
> **What's in this file:** Connector categories, business model and tier structure, operational moat thesis, license decision (FSL-1.1-Apache-2.0), and explicit scope decisions about what NOT to build yet.

---

## 5. Connector Categories

The product supports any tool that has a connector or exposes an MCP server. Build order is driven by design partner demand, not by this list.

| Category | Examples (not exhaustive) |
|---|---|
| **APM / Tracing** | Datadog, Jaeger, Honeycomb, Tempo, New Relic, Dynatrace |
| **Error tracking** | Sentry, Rollbar, Bugsnag, Raygun |
| **Log management** | Datadog Logs, GCP Cloud Logging, AWS CloudWatch, Elastic, Loki |
| **Cloud infrastructure** | AWS, GCP, Azure — metrics, resources, events |
| **Database observability** | MongoDB Atlas, PostgreSQL slow query logs, MySQL, Redis |
| **Source control** | GitHub, GitLab, Bitbucket — commits, PRs, deploys |
| **Incident management** | PagerDuty, OpsGenie, FireHydrant |
| **Project / issue tracking** | Jira, Linear, GitHub Issues |

**Framework principle:** Build the connector interface and aggregator routing first. Implement connectors one by one, prioritized by what design partners actually need. Never let the connector list drive architecture decisions.

**Implementation pattern** (per Section 4.5): For vendors with official MCP servers (AWS, GCP, Sentry, GitHub, Cloudflare, Stripe, and growing), use Implementation A (thin wrapper, ~100-200 LOC). For vendors without (still common: Loki, niche DB observability, internal vendor APIs), use Implementation B (SDK-direct, ~300-500 LOC).

**Standard vs. Enterprise connectors:**
- **Standard connectors** (in OSS): Sentry, GitHub, PagerDuty, CloudWatch, GCP Observability, Datadog, Grafana, basic Postgres, Linear/Jira basic
- **Enterprise connectors** (SaaS-paid axis): Splunk, ServiceNow, IBM Instana, Dynatrace, AppDynamics, Datadog Enterprise-tier APIs, Oracle Cloud Observability

Enterprise-connector pricing axis is well-understood (Grafana Enterprise plugins precedent). Buyers already paying six figures for Splunk/ServiceNow accept paying for connectors to them.

**First connector triple** (per design partner stack): probably GitHub + Sentry + one of {AWS CloudWatch, GCP Observability, Datadog}. Three is a credible demo and stress-tests fan-out. Don't pick before design partner conversation.

---

## 6. Business Model

### Operating Principle

**Monetize the operational moat, not the features.** The OSS version is fully functional; the SaaS converts customers because running the OSS at team scale becomes operationally painful, not because features are missing.

This principle is non-negotiable. Crippled OSS versions destroy trust faster than they generate revenue (see PostHog, GitLab's 2019 mistake, Sentry's contrast in doing it right).

### Tier Structure

| Tier | Real principle | What's in it |
|---|---|---|
| **OSS (free, self-hosted)** | Full functionality for any team willing to self-host | Substrate + investigation plugin, all standard connectors, **all three modes (1, 2, 3) available**, shared cache, **shared Investigation Sessions** (yes, even multi-engineer), session replay, PII redaction, audit log, basic RBAC (API key scoping), Slack feed, postmortem auto-skeleton, cost tracking, integration with any MCP-compliant client |
| **SaaS (Cloud)** | "We run it so you don't have to — especially the operationally complex Mode 3" | **Managed Mode 3** (we operate the credential vault and vending service — STS, Workload Identity, OAuth refresh, audit retention), managed hosting (multi-region, auto-scaling), SSO/SAML, automated backups, web UI for session replay and cross-incident search, cost dashboard, cross-incident pattern detection, **enterprise connectors** (Splunk, ServiceNow, Dynatrace, etc.) |
| **Enterprise** | Compliance and procurement gates; air-gap deployments | **Mode 3 self-hosted with our reference vending implementation** for air-gap/on-prem customers, SCIM provisioning, audit log long-term retention + export, SOC 2 evidence packs, private VPC, custom redaction rules, BYO Vault / AWS Secrets Manager integration, SLA, dedicated support |
| **AI Pro (future, 12-18 months out)** | Intelligence on top of substrate | RCA agent, cross-incident pattern detection at scale, auto-postmortems with reasoning, suggested-next-query. Closed-source SaaS-only. |

**Why this structure works (and why "Modes 2 & 3 in paid tier" would NOT work):**

The earlier instinct was to put Mode 2 and Mode 3 behind a paywall on the logic that "big companies who need them can pay." But this conflicts with the operating principle above: that's feature-gating security, which destroys trust and gets publicly shamed (sso.tax for SSO, similar dynamics for any security feature behind a paywall).

The corrected model is: **all modes available in OSS. SaaS sells operating Mode 3 on the customer's behalf.** Mode 3 self-hosted is genuinely operationally complex — you have to run a credential vault, integrate with STS/Workload Identity/OAuth-refresh patterns per vendor, manage audit retention, handle credential rotation. A team *can* run it themselves with our reference implementation, but most security-conscious teams will choose to pay us to run it because it's real infrastructure work. *That's* the conversion driver: operational complexity, not access to the feature.

This is the Sentry / Grafana / Supabase / PostHog pattern. OSS gives the full thing; the paid tier sells operational ease at scale.

**Marketing language matters here.**
- ❌ Don't say: "Mode 3 requires a paid plan."
- ✅ Do say: "Mode 3 requires operating a credential vending service. You can run this yourself with our open-source reference implementation, but most teams choose our managed SaaS to avoid the operational burden."

The first frames it as a paywall; the second frames it as managed-service value. Security-conscious readers can tell the difference, and reputation in SRE communities depends on getting this right.

### The Test for Tier Placement

If a feature exists primarily because a single engineer benefits from it during their work → OSS.

If a feature exists because the company's security/compliance/operations function needs it → paid.

By this test:
- Shared Sessions → OSS (engineer benefits)
- SSO/SAML → SaaS (security function need, but not Enterprise-tier — see SSO tax discussion)
- SCIM → Enterprise (procurement-level)
- PII redaction → OSS (engineer trust requirement)
- SOC 2 evidence packs → Enterprise (compliance function)

### Explicit Anti-Patterns to Avoid

- **Crippled OSS** ("OSS capped at 5 users", "OSS doesn't have Slack feed"): breeds resentment, never converts serious teams, pushes adopters to forks.
- **SSO tax** (putting SSO behind Enterprise tier only): now a reputational liability — sso.tax site publicly shames this. Cal.com and Tailscale explicitly avoid it.
- **Vague "basic vs advanced" feature splits**: worst kind of paywall, impossible to evaluate, signals desperation. PostHog learned this expensively.
- **Feature-gated paywalls in general**: the moat is operational, not feature-based.

### License Decision (locked)

**Apache 2.0 was ruled out for the core.** Cloud-vendor relicensing risk (Elastic → SSPL, HashiCorp Terraform → BSL, MongoDB → SSPL) is too real for an infra category that AWS/Microsoft/Datadog could absorb into their own offerings.

**License split (locked):**
- **Core (`packages/core` and first-party plugins like `packages/plugin-investigation`):** **FSL-1.1-Apache-2.0** (Sentry's "Functional Source License with 2-year Apache 2.0 conversion"). Each released version auto-converts to Apache 2.0 two years after release.
- **Connector SDK (`packages/connector-sdk`):** Apache 2.0 or MIT — anti-friction for community connector contributions.
- **`packages/auth/` (the MCP + Better Auth + Drizzle integration package):** Apache 2.0 or MIT — frictionless community adoption.
- **Future Plugin SDK (when extracted):** Apache 2.0 or MIT — same reason.
- **Community plugins/connectors:** authors' choice.

**Why FSL over BSL:**
- 2-year time horizon is more community-friendly than BSL's typical 4 years
- Simpler license text, easier for contributors and procurement legal reviews
- Modern OSS-infra precedent (Sentry, Sourcegraph) is increasingly choosing FSL
- BSL has known reputation baggage (HashiCorp's BSL adoption triggered the OpenTofu fork)
- FSL specifically targets the threat model (cloud vendor competing managed service); BSL's broader restrictions are unnecessary

**Honest framing of what the license does:**

FSL is a *soft deterrent and legal hook*, not a technical enforcement mechanism. The kinds of violations FSL prevents (competing commercial SaaS) are inherently public — you can't run a SaaS business secretly. The license sets a clear social norm, creates reputation cost for violators, and provides legal grounds if action is ever needed. Most users will never notice the license because the 99% of legitimate uses (internal, modification, contribution, consulting, research, customer use) are fully allowed from day one.

---

## 6.5. Operational Moat Thesis

### Why this section exists

OSS-core companies that try to design the operational moat upfront build the wrong things. Sentry, Supabase, GitLab all earned their moats by responding to real usage at scale, not by whiteboarding them in advance.

However, investors at seed need to hear a *thesis* about where the moat will live, even if the specifics aren't built. This section is the framework, not the spec.

### Where the moat will likely emerge

Based on how analogous OSS-infra companies built moats, the candidates for this product are:

1. **Correlation-aware cache** — Cache that knows when a deploy event invalidates upstream APM data is harder to operate than a generic Redis. Multi-region replication for distributed teams is harder still. Self-hosters can run Redis; running this version of cache correctly is a skill investment.

2. **Session storage and search at scale** — Tens of thousands of incident sessions, millions of tool calls, full-text search across all of them is a real search-index problem (Elastic/OpenSearch/Meilisearch) + cold storage problem (S3 with retrieval) + query performance problem. Easy at 100 sessions. Operationally painful at 100,000.

3. **Connector update cadence** — Vendors change APIs without notice. SaaS users get continuous updates; self-hosters either pin to old connectors (breaking quietly) or pull from a maintained registry. Weekly connector update cadence as a SaaS feature is a real reliability moat.

4. **Subprocess pool reliability at scale** — Managing dozens of STDIO MCP server subprocesses per tenant, multiplied by tenants, with idle pre-warming and lifecycle management. Self-hosters discover this is real infrastructure.

5. **Slack integration reliability** — Persistent socket connection per workspace, OAuth refresh, retry on rate limit, threading across reconnects, signed request verification.

6. **Cross-incident pattern detection at scale** — Requires reliable session storage at scale, which requires the operational substrate above. This is the eventual AI Pro vector.

### Investor-facing thesis (for fundraise conversations)

> "OSS-core infra businesses monetize three predictable axes: managed hosting for teams who don't want to operate it, enterprise features around compliance and procurement, and premium connectors to expensive enterprise systems. We expect our specific operational moat to emerge around cache correlation logic, connector update cadence, subprocess pool reliability, and session search at scale, based on how analogous companies (Sentry, Grafana, Supabase) evolved. We're deliberately not over-designing the moat before we have real usage signals, because over-designed moats produce the wrong product."

This is the answer to "how will you make money" at seed. The framework + comparables + discipline is more fundable than a detailed pricing matrix that signals guessing.

### What to preserve architecturally now

Even though we're deferring moat *design*, we cannot foreclose moat *options*:
- Postgres (already locked)
- Cache abstraction layer (already locked — connector-declared cache policy, not generic)
- Pluggable session storage backend in the investigation plugin
- Pluggable connector registry (already locked — npm packages + config-driven loading)
- Plugin contract that supports future workflow plugins without core rewrites
- Multi-tenant data isolation primitives in the schema from day one

---

## 7. What NOT to Build Yet

- **Autonomous RCA Agent** — Confirmed deferred. Crowded category, requires data scale, requires evaluation infrastructure, requires enterprise sales motion this team isn't built for yet. Keep in vision narrative; not in roadmap. 12-18 months minimum.
- **Write operations** — Stay read-only for MVP and v1. The "where does read-only end?" question has competitive implications (PagerDuty + AWS DevOps Agent territory) and deserves a deliberate answer before expanding. Read-only is also what the industry's graded-autonomy framework calls the safe starting tier.
- **Mode 2 (local-runs-subprocess + local creds)** — Architecture supports it from day one via `ConnectorContext`. *Implementation* is Phase 2, after Mode 1 is shipped to a design partner and validated. Don't build the local agent package speculatively.
- **Mode 3 (local-runs-subprocess + cloud-vended creds)** — Architecture supports it from day one. *Implementation* is Phase 3 (cred vault + per-vendor vending services). This is the SaaS conversion point and the most operationally complex piece — defer until Modes 1 and 2 are validated.
- **`@parallax/agent` local package** — Doesn't exist in Mode 1. Built in Phase 2. Designing it speculatively before Mode 1 ships would slow Phase 1 without benefit.
- **Per-user vendor OAuth as default** — Default is team-shared service-account-style (Pattern A or B per connector). Per-user OAuth (Pattern C) is supported as an opt-in for the rare cases that need it, off by default.
- **HashiCorp Vault / AWS Secrets Manager integration for credential storage** — Enterprise upgrade, not v0. Postgres-encrypted-at-rest is sufficient until a customer specifically asks.
- **OIDC federation, mTLS, automated key rotation** — Defer to enterprise asks. Not v0/v1 work.
- **CIMD (Client ID Metadata Document) for OAuth registration** — DCR is sufficient for now; most clients still use DCR. Add CIMD when Claude/Cursor/etc. ship it.
- **SSO/SAML beyond basic Better Auth integration** — Defer to first enterprise customer's specific identity provider needs.
- **Full multi-tenant Enterprise RBAC** — API key scoping is sufficient for MVP. Building project/service-level RBAC before paying customers is waste.
- **Formal Plugin SDK with external stability promise** — design clean seams for plugin #1, but don't promise external plugin authors anything until plugin #2 forces the API to be extracted. "Design for plugins, ship one."
- **Generic plugin/connector marketplace UI** — defer until 5+ first-party plugins/connectors prove the categorization.
- **Code mode (Bifrost-style)** — promising token-reduction strategy but requires sandboxing infrastructure. v2+ consideration, not v0.
- **In-process connector sandboxing (Worker threads / subprocess isolation)** — defer until enterprise customer specifically asks. Document trust boundary in README so users know what they're enabling.
- **Web UI for management** — every comparable project has one eventually (MetaMCP, MCPX, Airis). Not v0. Built when self-hosters ask for it.

---
