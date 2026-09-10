# Parallax — Project Context Files

> Product name locked: **Parallax**. See `05-open-questions.md` for the naming rationale and outstanding namespace/trademark checks.

This directory holds the project context for **Parallax** — an OSS-core, read-only investigation workflow layer that sits between an engineer's LLM client (Cursor, Claude Code, Windsurf, Antigravity, ChatGPT, VS Code, Zed, Codex CLI, JetBrains, and other MCP-compliant clients) and their MCP gateway / vendor MCP servers. The wedge: incident-keyed Investigation Sessions, a cross-vendor correlation primitive, session replay, postmortem auto-skeleton, and cost attribution as session metadata.

**These are internal planning docs — not the repo README.** The repo's `README.md` (in the eventual code repository) will be the OSS-user-facing document. These context files are for the three founders, future team members, and for AI assistants helping with planning conversations.

## How to use these files

**Starting a new conversation with an AI assistant (Claude, Cursor, etc.):**
Paste the contents of `00-overview.md`. That gives the AI enough context to be useful without overwhelming it. Reference other files as needed.

**Asking an AI to summarize a specific area:**
Point the AI at the relevant scoped file (e.g., "summarize 01-architecture.md," or "explain the business model — see 02-business-and-product.md").

**Looking for a specific decision or open question:**
Start with `05-open-questions.md`. The "Recently resolved" section is the fastest way to see what's been locked.

## File index

| File | Purpose |
|---|---|
| `00-overview.md` | Master overview: what this is, the problem, what's genuinely new, and the running change log of locked decisions. **Start here for new conversations.** |
| `01-architecture.md` | Locked technical spine: tech stack, connector model, plugin architecture, three credential modes, two-layer authentication, subprocess pool, phased implementation, MCP client compatibility. |
| `02-business-and-product.md` | Connector categories, business model and tiers, operational moat thesis, license decision (FSL-1.1-Apache-2.0), and explicit scope decisions about what NOT to build yet. |
| `03-competitive-landscape.md` | Honest current map of competitors and complements — MCP gateways, hyperscaler agents, autonomous AI SRE, vendor-native AI, incident management adjacents. |
| `04-team-validation-launch.md` | Locked team-level decisions, ICP, validation playbook, OSS launch sequence, phased build timeline (Mode 1 → Mode 2 → Mode 3). |
| `05-open-questions.md` | Living list of open questions, recently resolved items, and topics flagged for future sessions. **Most-updated file** as decisions land. |

## Conventions

- **Markdown only**, optimized for both human and LLM consumption. ASCII diagrams in fenced code blocks; no binary images.
- **Section numbers preserved across files.** "Section 4.14" inside `01-architecture.md` is the same numbering as if everything were still in one file. Cross-references between files use these numbers plus the filename.
- **`[DECISION]` and `✅` mark locked decisions.** `[PENDING]` and `⬜` mark things still open.
- **Each file has a "Last updated" line at the top.**

## Update workflow

When a decision is locked or material changes:
1. Update the relevant scoped file (e.g., new architecture decision → `01-architecture.md`).
2. Add a numbered entry to the "What Changed" section in `00-overview.md`.
3. Move newly resolved items in `05-open-questions.md` from "Open Questions" to "Recently resolved."
4. Update the "Last updated" line in the affected file(s).

This keeps `00-overview.md` (the file pasted into new conversations) always current without requiring readers to skim every file.

## Origin

These files are the output of a series of architecture and strategy conversations between the founder and Claude in May 2026, building from initial product idea → market validation → tech stack lock-in → auth & credentials architecture → strategic locks (license, IP resolution, design partners). The single source file has been preserved at `../investigation-mcp-context.md` for reference; this split is the working format going forward.
