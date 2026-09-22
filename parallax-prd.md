# Product Requirements Document (PRD)
## **Parallax — The Enterprise Incident Investigation & Collaboration Layer**

**Document Version:** 1.0 (Enterprise Business Edition)  
**Target Market:** Mid-Market to Fortune 500 Engineering Organizations ($50M+ ARR, 100+ Engineers)  
**Primary Buyers:** VP of Engineering, Chief Technology Officer (CTO), Head of SRE / Infrastructure  
**Core Thesis:** *Monetize the operational and security moat of collaborative incident investigation while giving engineering teams an open-source, read-only AI workflow layer they can trust.*

---

## 1. Executive Summary & Business Case

### 1.1 The Enterprise Problem
Modern engineering organizations run on fragmented observability stacks—averaging 3 to 7 tools across cloud providers (GCP, AWS), error monitoring (Sentry), APM/logging (Datadog, Splunk), and source control (GitHub, GitLab). 

During P0/P1 production outages, companies face four compounding financial and operational drains:
1. **Downtime Costs ($9,000+/minute):** According to Gartner and IDC, enterprise downtime costs between $300,000 and $540,000 per hour. Over 70% of MTTR (Mean Time to Resolution) is spent on **Mean Time to Understand (MTTU)**—tab-hopping, copying commit SHAs, matching timestamps, and manually correlating logs across disparate systems.
2. **Context Loss & War Room Fatigue:** When a secondary engineer or incident commander joins a live war room, the lead investigator spends 15–30 minutes briefing them on what has already been tried. Once the incident resolves, that investigative context is lost forever.
3. **Observability API Overages & Rate Limits:** Multiple engineers running uncoordinated, duplicate log and APM queries during an outage frequently hit vendor rate limits or trigger six-figure ad-hoc query overages.
4. **Autonomous Agent Hesitancy:** Purely autonomous AI remediation agents (which execute write actions or automated deployments) face severe pushback from security, compliance, and risk teams due to hallucinations and unauthorized infrastructure mutations.

### 1.2 The "Can't-Say-No" Value Proposition
Parallax is the **Read-Only, Collaborative Investigation Layer** that sits between engineers' AI coding assistants (Cursor, Claude Code, Windsurf, Antigravity, VS Code) and the company’s observability stack.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               PARALLAX ENTERPRISE ROI                                  │
├────────────────────────────────┬───────────────────────────────┬───────────────────────┤
│       40% MTTR Reduction       │      100% Shared Context      │  $0 Accidental Writes │
│  Cuts MTTU by auto-correlating │ Zero onboarding friction for  │ Read-only guardrails  │
│  GCP logs, Sentry & GitHub.    │ war rooms via live sync.      │ eliminate risk.       │
├────────────────────────────────┼───────────────────────────────┼───────────────────────┤
│    30-50% Vendor API Savings   │   Instant Living Postmortems  │ SOC 2 / DORA Compliant│
│  Team-wide shared cache dedu-  │ Auto-generated evidence trails│ Immutable audit logs &│
│  plicates identical queries.   │ directly into Notion/Docs.    │ real-time PII mask.   │
└────────────────────────────────┴───────────────────────────────┴───────────────────────┘
```

---

## 2. Personas & Buying Committee Dynamics

| Persona | Core Pain Point | How Parallax Wins Them Over |
|---|---|---|
| **VP of Engineering / CTO** | High MTTR impacting revenue SLAs; mounting AI token & observability bills. | Concrete MTTR reduction metrics; per-incident cost attribution dashboard; zero risk of rogue write actions. |
| **Head of SRE / Incident Commander** | Constant context switching; chaotic war rooms; low-quality, forgotten postmortems. | Real-time Slack feeds of investigation steps; single-click living postmortems; multi-engineer shared sessions. |
| **Senior Staff / On-Call SRE** | 3 AM tab-hopping across 5 consoles; repetitive log querying. | Investigates conversationally directly from their favorite IDE (Cursor, Claude Code, etc.) with automatic cross-vendor correlation. |
| **CISO / Head of Compliance** | Engineers pasting sensitive logs/tokens into cloud LLMs; lack of audit trails during outages. | Zero-trust ephemeral credential vending (Mode 3); centralized in-flight PII/secret redaction; immutable audit logs. |

---

## 3. Product Architecture & Core Modules

```
                    ENGINEERING INTERFACES (MCP Clients)
      ┌──────────────┬──────────────┬──────────────┬──────────────┐
      │ Cursor / IDE │ Claude Code  │ Antigravity  │  Slack Bot   │
      └──────┬───────┴──────┬───────┴──────┬───────┴──────┬───────┘
             │              │              │              │
             ▼              ▼              ▼              ▼
 ═══════════════════════════════════════════════════════════════════════════
                           PARALLAX PLATFORM GATEWAY
    [ OAuth 2.1 / PKCE ]  [ PII Redaction Engine ]  [ Rate-Limit Guard ]
 ═══════════════════════════════════════════════════════════════════════════
                                    │
                                    ▼
 ┌─────────────────────────────────────────────────────────────────────────┐
 │                       CORE VALUE ENGINES                                │
 │                                                                         │
 │  1. MULTI-ENGINEER COLLABORATION ENGINE                                 │
 │     • Live Session Multiplexing • Active Co-pilot Sync                  │
 │                                                                         │
 │  2. CROSS-VENDOR CORRELATION ENGINE                                     │
 │     • Time-Window Anomaly Sync (GCP Logs + Sentry Errors + GitHub PRs)  │
 │                                                                         │
 │  3. SHARED TEAM CACHE & FINOPS TRACKER                                  │
 │     • Content-Addressable Redis Cache • Per-Session Cost Attribution    │
 │                                                                         │
 │  4. LIVING POSTMORTEM & INSTITUTIONAL MEMORY ENGINE                     │
 │     • Multi-Engineer Timeline Synthesizer • Cross-Incident Search       │
 │                                                                         │
 │  5. ENTERPRISE CREDENTIAL & COMPLIANCE ENGINE                           │
 │     • Ephemeral Credential Vending (GCP WIF / AWS STS) • Immutable Audit│
 └──────────────────────────────────┬──────────────────────────────────────┘
                                    │
                                    ▼
                           OBSERVABILITY LAYER
      ┌──────────────┬──────────────┬──────────────┬──────────────┐
      │ GCP Logging  │    Sentry    │  GitHub Org  │ Datadog / APM│
      └──────────────┴──────────────┴──────────────┴──────────────┘
```

---

## 4. Comprehensive Feature Specifications

### Module 1: Multi-Engineer Collaborative War Room
*Objective: Eliminate context loss and war room onboarding friction when multiple engineers investigate concurrently.*

* **F1.1 Incident-Keyed Investigation Sessions:**
  * Engineers create or attach to a shared session via `investigation__create_session(incident_id, title)` or `investigation__join_session(session_id)`.
  * All active participants (e.g., Alice in Cursor, Bob in Claude Code) share a continuous, synchronized event stream.
* **F1.2 Co-Pilot Awareness & Deduplication:**
  * Tool: `investigation__get_session_activity(session_id, since_timestamp)`.
  * Allows Bob’s LLM agent to review Alice’s prior discoveries (e.g., "Alice already queried Sentry issue `#412` and confirmed a `500 NullPointer` in `OrderService`").
  * Prevents duplicate queries and directs Bob’s agent toward complementary hypotheses (e.g., searching recent GitHub deployments).
* **F1.3 Passive Incident Commander Slack Feed:**
  * When a session is linked to a Slack incident channel (e.g., `#inc-402-checkout-down`), Parallax streams single-line, human-readable investigation milestones in real time.
  * Example: `[14:02 UTC] @alice queried GCP Cloud Logging (severity>=ERROR) → 412 errors found in checkout-pod-89a`.
  * Allows leadership and stakeholders to follow progress without interrupting the on-call engineers.

---

### Module 2: Cross-Vendor Correlation Primitive
*Objective: Transform isolated data points into immediate root-cause hypotheses without requiring explicit engineer prompting.*

* **F2.1 Implicit Time-Window Anomaly Detection:**
  * Whenever a connector executes a query (e.g., fetching error rates from GCP Cloud Logging or Sentry), the Parallax engine automatically inspects the ±30 minute window across all other connected systems.
  * Responses are returned with a standardized, lightweight `_correlation` metadata payload:
    ```json
    {
      "results": [ "...log data..." ],
      "_correlation": {
        "time_window": "2026-09-10T18:00:00Z → 2026-09-10T18:30:00Z",
        "github_deploys": [
          { "repo": "org/payment-service", "commit": "8f3b1a", "author": "dev@co.com", "deployed_at": "18:12:00Z" }
        ],
        "sentry_error_spikes": [
          { "issue": "PAY-88", "count": 1420, "first_seen": "18:14:00Z" }
        ],
        "anomaly_verdict": "High correlation: Error spike began 2 minutes post-deployment 8f3b1a."
      }
    }
    ```
* **F2.2 Standard Verb Fan-Out:**
  * Unified high-level verbs (`logs.search`, `errors.search`, `traces.search`, `deploys.list`) fan out across GCP, Sentry, and GitHub in parallel via `Promise.allSettled`, normalizing diverse data formats into a consistent schema with full source provenance (`_source: 'gcp'`).

---

### Module 3: Enterprise Shared Cache & FinOps Cost Control
*Objective: Eliminate runaway API bills and reduce query latency during critical incidents.*

* **F3.1 Content-Addressable Team Cache (Redis/Valkey):**
  * Queries are hashed based on normalized parameters (log filters, time windows, environment tags).
  * If Engineer A runs an expensive log aggregation query, Engineer B (and their respective AI agents) receives an instantaneous (~5ms) cached response with `cache_hit: true`.
  * Prevents vendor API rate-limiting during high-concurrency incidents.
* **F3.2 Granular Per-Incident Cost Attribution:**
  * Every tool call calculates estimated infrastructure costs (LLM tokens + vendor API quota cost).
  * Aggregated at the `session_id` level and exposed via management dashboards and postmortem reports.
  * Answers executive questions: *"What was our total LLM and observability compute cost for P0 Incident 402?"*

---

### Module 4: Living Postmortems & Institutional Memory
*Objective: Turn ephemeral outage debugging into permanent, searchable engineering assets.*

* **F4.1 Single-Click Living Postmortem Generation:**
  * Upon calling `investigation__close_session(session_id, verdict)`, Parallax automatically synthesizes:
    1. **Chronological Timeline:** Interleaving every query, finding, and hypothesis tested by all participants.
    2. **Evidence Locker:** Exact log snippets, error stack traces, commit diffs, and deep links.
    3. **Efficiency Scorecard:** Total time to resolution, total queries run, cache hit %, and participant list.
  * Direct one-click export into **Notion, Confluence, Google Docs, and Jira/Linear**.
* **F4.2 Cross-Incident Search & Historical Replay:**
  * Tool: `investigation__search_sessions(query: "Redis connection pool timeout")`.
  * Future on-call engineers can instantly query how similar past incidents were diagnosed and resolved, preventing teams from solving the same problem from scratch.

---

### Module 5: Enterprise Security, Privacy & Compliance (The Trust Shield)
*Objective: Guarantee zero data leakage and satisfy strict enterprise security requirements (SOC 2 Type II, ISO 27001, DORA, HIPAA).*

* **F5.1 In-Flight PII & Secret Redactor:**
  * Real-time regex and NER engine that masks API keys, bearer tokens, passwords, credit cards (PCI-DSS), and emails before tool outputs are transmitted to LLM clients or stored in databases.
* **F5.2 Three-Tier Credential Architecture (`ConnectorContext`):**
  * **Mode 1 (SaaS / Quickstart):** Cloud-stored encrypted credentials for fast POCs.
  * **Mode 2 (Local Air-Gap):** Local execution via `@parallax/agent` reading local CLI credentials (GCP ADC, AWS profiles) with zero cloud exposure.
  * **Mode 3 (Enterprise Managed Vending):** Centralized long-lived keys in customer vault; Parallax issues **ephemeral, short-lived tokens** (GCP Workload Identity Federation, AWS STS 15-minute AssumeRole) to local agents.
* **F5.3 Immutable Audit Logging:**
  * Every single query is logged with cryptographic timestamps, recording: `User ID`, `IP Address`, `Client Type`, `Target System`, `Query Args`, and `Execution Time`.
  * Exportable directly to customer SIEM (Splunk, Datadog Security, AWS S3).

---

### Module 6: Token-Optimized Developer Experience
*Objective: Zero friction for developers while protecting LLM context windows.*

* **F6.1 Airis-Style Dynamic Schema Partitioning:**
  * Standard `tools/list` returns lightweight, top-level tool signatures (reducing context token consumption by 85–90%).
  * Exposes `expand_schema(tool_name)` on-demand when the LLM decides to construct a specific query.
* **F6.2 Universal Client Compatibility (300+ MCP Clients):**
  * Out-of-the-box support for **Cursor, Claude Code, Google Antigravity, Windsurf, VS Code + GitHub Copilot, Zed, and JetBrains**.
  * Seamless authentication via **OAuth 2.1 (PKCE & DCR)** and static API keys.

---

## 5. Non-Functional Requirements (NFRs)

| Dimension | Enterprise Requirement |
|---|---|
| **Latency** | < 15ms overhead added to raw vendor MCP calls; < 5ms for Redis cache hits. |
| **Availability & SLA** | 99.95% uptime for SaaS; multi-region active-passive failover. |
| **Concurrency** | Multiplex up to 64 concurrent tool calls per `{team_id, connector}` subprocess without thread locking. |
| **Data Retention** | Configurable: 30 days (default), 365 days (Pro), or indefinite with BYO S3/GCS bucket (Enterprise). |
| **Security Standards** | TLS 1.3 in transit, AES-256 at rest; SOC 2 Type II certified; SAML 2.0 / SCIM 2.0 provisioning. |

---

## 6. Enterprise Packaging, Tiers & Monetization Strategy

To preserve developer trust and maximize bottom-up adoption, **all core investigation features are included in open source**. Parallax monetizes the **operational complexity and enterprise security moat**.

```
┌─────────────────────────┬─────────────────────────┬─────────────────────────┐
│     COMMUNITY (OSS)     │      PRO TEAM SAAS      │   ENTERPRISE CLOUD/VPC  │
│      $0 / Self-Hosted   │   $39 / Engineer / Mo   │      Custom Annual      │
├─────────────────────────┼─────────────────────────┼─────────────────────────┤
│ • Full Substrate Core   │ • Fully Managed Cloud   │ • Managed Mode 3 (Vault)│
│ • All 3 Credential Modes│ • Multi-Engineer Sync   │ • Private VPC / Air-Gap │
│ • Sentry, GCP, GitHub   │ • Slack Live Incident   │ • SAML SSO & SCIM Sync  │
│ • Local Shared Cache    │   Feed Integration      │ • Splunk/Dynatrace/     │
│ • Basic Postmortems     │ • 90-Day Session History│   ServiceNow Connectors │
│ • FSL-1.1 License       │ • FinOps Cost Dashboard │ • SOC 2 Evidence Packs  │
│                         │ • Managed Redis Cache   │ • Custom PII Rules      │
│                         │                         │ • 24/7 Dedicated Support│
└─────────────────────────┴─────────────────────────┴─────────────────────────┘
```

---

## 7. Go-To-Market (GTM) & Customer Expansion Playbook

### Phase 1: Land (The Bottom-Up Wedge)
* SRE / On-call engineer installs Parallax open source via Docker Compose or connects Cursor to the hosted sandbox.
* They experience immediate value on their next on-call shift: GCP logs, Sentry errors, and GitHub commits correlate automatically in their IDE.

### Phase 2: Expand (Team War Room Adoption)
* The engineer shares an active session link in the team Slack during an outage.
* 3 other engineers join via their own IDEs. The team realizes they are debugging on a unified cache and timeline without stepping on each other.
* The team upgrades to **Pro SaaS** to maintain persistent Slack feeds and cloud session synchronization.

### Phase 3: Scale (Enterprise CISO / VP Eng Standardization)
* Security and infrastructure leadership mandates Parallax across all engineering departments to enforce **Mode 3 Ephemeral Credential Vending**, **PII redaction**, and **centralized SOC 2 audit logging**.
* Enterprise upgrades to unlock **ServiceNow/Splunk connectors** and **Private VPC deployment**.

---

## 8. Definition of Success (KPIs)

1. **MTTR Reduction:** Average decrease of **35% or greater** in incident resolution time for participating teams within 60 days of rollout.
2. **Postmortem Velocity:** Postmortem drafts completed and published in **< 15 minutes** post-incident (down from the 2–4 hour industry average).
3. **Cache Efficiency:** **> 30% cache hit rate** during multi-engineer incident sessions, directly reducing vendor API bills.
4. **Net Revenue Retention (NRR):** **> 130%** driven by expanding seat licenses from SRE teams to broader product development teams.
