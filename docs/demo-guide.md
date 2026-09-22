# Parallax MVP — Local Demo Guide (Cursor & Claude Code)

This guide walks you through setting up and running a live, two-engineer collaborative incident investigation using **Cursor** (as Alice) and **Claude Code** (as Bob) connected to Parallax.

---

## 1. Quickstart (Under 2 Minutes)

### Step 1: Start PostgreSQL and Redis
```bash
docker compose up -d
```

### Step 2: Install Dependencies & Build Packages
```bash
pnpm install
pnpm build
```

### Step 3: Run Database Migrations & Seed
```bash
pnpm db:migrate
pnpm db:seed
```
This automatically sets up:
* **Team:** Acme Payments Corp
* **Engineer Alice (Cursor):** Token `user_alice_cursor`
* **Engineer Bob (Claude Code):** Token `user_bob_claude`

### Step 4: Start the Parallax Server
```bash
pnpm dev
```
The server will be running on `http://localhost:3100/mcp`.

---

## 2. Automated Dual-Session Verification (1-Command Test)

To test the entire multi-engineer workflow automatically in your terminal:
```bash
pnpm demo
```
This simulates:
1. **Alice** connecting via Cursor and opening an incident session.
2. **Alice** searching GCP logs and Sentry error stack traces.
3. **Cross-Vendor Correlation** automatically detecting a recent GitHub deployment.
4. **Bob** connecting via Claude Code, listing active sessions, and joining.
5. **Bob** querying the same GCP log filter, getting an **instant 0ms Redis cache hit**.
6. **Bob** resolving the incident and generating the **Living Postmortem**.

---

## 3. Connecting Live IDEs (Manual Testing)

### Connecting Client 1: VS Code or Cursor (Alice)

#### In VS Code:
We have created [`.vscode/mcp.json`](file:///Users/yassir/Documents/GitHub/parallax/.vscode/mcp.json) in this repository. If you are using VS Code with **GitHub Copilot**, **Cline**, **Roo Code**, or **Continue.dev**:

1. **Cline / Roo Code / Continue Extension:** Open extension settings → MCP Servers → paste:
```json
{
  "mcpServers": {
    "parallax-alice": {
      "url": "http://localhost:3100/mcp",
      "headers": {
        "Authorization": "Bearer user_alice_cursor"
      }
    }
  }
}
```

#### In Cursor:
Add the snippet above to your Cursor MCP settings (`~/.cursor/mcp.json` or Settings → MCP).

#### Test in VS Code / Cursor Chat:
> *"Create a new investigation session for incident INC-1042 titled 'Checkout latency spike in GCP'"*  
> *"Search GCP logs for errors in the last 15 minutes"*  
> *"Search Sentry for unresolved issues"*

---

### Connecting Client 2: Claude Code (Bob)
In a separate terminal window, register Parallax in Claude Code:

```bash
claude mcp add --transport http parallax-bob http://localhost:3100/mcp --header "Authorization: Bearer user_bob_claude"
```

#### Test in Claude Code:
> *"List open investigation sessions"*  
> *"Join the active session for INC-1042"*  
> *"Show me recent session activity to see what Alice has found so far"*  
> *"Search GCP logs for the same error filter"* *(Notice the cache hit!)*  
> *"Close the session with verdict 'Root cause: DB connection pool exhaustion from PR 892' and show me the postmortem report"*
