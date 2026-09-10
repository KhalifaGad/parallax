# Parallax MVP — Technical Blueprint & Implementation Specification
**Document Classification:** Staff Engineering Blueprint & Implementation Plan  
**Target Milestone:** MVP (Phase 1 / Mode 1 — Multi-Engineer Shared Investigation)  
**Primary Stack:** TypeScript (strict), Node.js 22 LTS, Fastify, `@modelcontextprotocol/sdk`, PostgreSQL 16 (Drizzle ORM), Redis 7.x, pnpm workspaces  
**Target Audience:** Core Engineering Team  

---

## 1. System Topology & Architecture Overview

Parallax acts as an **intelligence and workflow proxy** between developer MCP clients (Cursor, Claude Code, Antigravity, Windsurf) and upstream observability services (GCP Cloud Logging, Sentry, GitHub).

```
   ┌────────────────────────┐      ┌────────────────────────┐
   │    Alice (Cursor)      │      │   Bob (Claude Code)    │
   └───────────┬────────────┘      └───────────┬────────────┘
               │                               │
               │  Streamable HTTP + JSON-RPC   │
               │  (OAuth 2.1 PKCE / API Key)   │
               ▼                               ▼
  ══════════════════════════════════════════════════════════════════
               PARALLAX FASTIFY SERVER (/mcp endpoint)
  ══════════════════════════════════════════════════════════════════
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
   ┌───────────────────────┐       ┌────────────────────────┐
   │  Functional Pipelines │       │   Identity & Security  │
   │  • PII/Secret Masking │       │   • OAuth 2.1 / PKCE   │
   │  • Schema Partitioning│       │   • Better Auth Engine │
   │  • Audit Logging      │       │   • Team Scoping       │
   └───────────┬───────────┘       └───────────┬────────────┘
               │                               │
               ▼                               ▼
   ┌────────────────────────────────────────────────────────┐
   │             Substrate Core (`packages/core`)           │
   │  • Session Event Coordinator                           │
   │  • Multi-Tenant STDIO Subprocess Pool                  │
   │  • Correlation Engine (Time-Window Cross-Vendor Sync)  │
   │  • Redis Content-Addressable Shared Cache              │
   └───────────────────────────┬────────────────────────────┘
                               │
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                  ▼
     ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
     │connector-gcp │   │connector-    │   │connector-    │
     │(Cloud Logs & │   │sentry        │   │github        │
     │ Cloud Trace) │   │(Issues/Stack)│   │(Commits/PRs) │
     └──────┬───────┘   └──────┬───────┘   └──────┬───────┘
            │                  │                  │
            ▼ (STDIO Subproc)  ▼ (STDIO Subproc)  ▼ (STDIO Subproc)
     ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
     │ Google Cloud │   │ Sentry MCP   │   │ GitHub MCP   │
     │ MCP / SDK    │   │ Server       │   │ Server       │
     └──────────────┘   └──────────────┘   └──────────────┘
```

---

## 2. Monorepo Structure (`pnpm-workspace.yaml`)

```
parallax/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── docker-compose.yml
├── .env.example
├── packages/
│   ├── core/                        # Server shell, MCP edge, middleware, subprocess pool
│   │   ├── src/
│   │   │   ├── index.ts             # Fastify server entrypoint
│   │   │   ├── server.ts            # Fastify HTTP + /mcp route mounting
│   │   │   ├── middleware/          # Functional middleware pipeline
│   │   │   │   ├── compose.ts
│   │   │   │   ├── pii-redactor.ts
│   │   │   │   ├── schema-partition.ts
│   │   │   │   ├── shared-cache.ts
│   │   │   │   └── audit.ts
│   │   │   ├── pool/                # STDIO subprocess pool & JSON-RPC multiplexer
│   │   │   │   ├── server-pool.ts
│   │   │   │   └── process-instance.ts
│   │   │   └── storage/             # Drizzle client, Redis client
│   │   │       ├── db.ts
│   │   │       ├── redis.ts
│   │   │       └── schema/          # Drizzle tables
│   │   │           ├── auth.ts
│   │   │           ├── credentials.ts
│   │   │           └── sessions.ts
│   ├── auth/                        # Publishable OAuth 2.1 + Better Auth adapter
│   │   ├── src/
│   │   │   ├── oauth-handler.ts     # RFC 9728 metadata, DCR, PKCE validation
│   │   │   └── token.ts
│   ├── connector-sdk/               # Types, standard verb schemas, ConnectorContext
│   │   ├── src/
│   │   │   ├── types.ts
│   │   │   ├── context.ts           # ConnectorContext interface & CloudRuntime
│   │   │   ├── verbs.ts             # Zod schemas for logs.search, errors.search, etc.
│   │   │   └── tool-naming.ts       # parseToolName, createToolName utilities
│   ├── connector-gcp/               # GCP Cloud Logging & Cloud Trace connector
│   ├── connector-sentry/            # Sentry Issues & Events connector
│   ├── connector-github/            # GitHub Commits, PRs & Deploys connector
│   └── plugin-investigation/        # The Core Value Plugin
│       ├── src/
│       │   ├── tools/               # 7 Core investigation MCP tools
│       │   ├── correlation/         # Cross-vendor time-window correlation logic
│       │   └── postmortem/          # Markdown living postmortem synthesizer
```

---

## 3. Database Schema Specification (PostgreSQL 16 + Drizzle ORM)

File: `packages/core/src/storage/schema/index.ts`

```typescript
import { pgTable, uuid, text, timestamp, boolean, jsonb, numeric, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// 1. Teams & Organizations
export const teams = pgTable('teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 2. Users (Engineers)
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id').references(() => teams.id).notNull(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: text('role').notNull().default('engineer'), // 'admin' | 'engineer'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 3. Connector Credentials (Encrypted at Rest)
export const connectorCredentials = pgTable('connector_credentials', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id').references(() => teams.id).notNull(),
  userId: uuid('user_id').references(() => users.id), // NULL = team-shared service account
  connectorName: text('connector_name').notNull(),    // 'gcp', 'sentry', 'github'
  providerType: text('provider_type').notNull(),      // 'static_json' | 'api_key' | 'oauth_token'
  scopeType: text('scope_type').notNull().default('team_shared'), // 'team_shared' | 'per_user'
  encryptedPayload: text('encrypted_payload').notNull(), // AES-256-GCM ciphertext
  iv: text('iv').notNull(),
  tag: text('tag').notNull(),
  initiatedByUserId: uuid('initiated_by_user_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  scopeCheck: check('scope_consistency_check', 
    sql`(${table.scopeType} = 'team_shared' AND ${table.userId} IS NULL) OR (${table.scopeType} = 'per_user' AND ${table.userId} IS NOT NULL)`
  ),
  teamConnectorIdx: index('team_connector_idx').on(table.teamId, table.connectorName),
}));

// 4. Investigation Sessions (The Incident-Keyed Entity)
export const investigationSessions = pgTable('investigation_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id').references(() => teams.id).notNull(),
  incidentId: text('incident_id').notNull(),          // e.g. "INC-1042"
  title: text('title').notNull(),
  status: text('status').notNull().default('active'), // 'active' | 'closed'
  createdByUserId: uuid('created_by_user_id').references(() => users.id).notNull(),
  verdict: text('verdict'),                           // Root cause summary
  postmortemMarkdown: text('postmortem_markdown'),    // Auto-generated report
  createdAt: timestamp('created_at').defaultNow().notNull(),
  closedAt: timestamp('closed_at'),
}, (table) => ({
  teamIncidentIdx: index('team_incident_idx').on(table.teamId, table.incidentId),
  statusIdx: index('session_status_idx').on(table.status),
}));

// 5. Session Participants (Multi-Engineer Tracking)
export const sessionParticipants = pgTable('session_participants', {
  sessionId: uuid('session_id').references(() => investigationSessions.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
  lastSeenAt: timestamp('last_seen_at').defaultNow().notNull(),
}, (table) => ({
  pk: index('session_user_pk').on(table.sessionId, table.userId),
}));

// 6. Session Event Stream (Unified Activity Log)
export const sessionEvents = pgTable('session_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => investigationSessions.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  toolName: text('tool_name').notNull(),              // e.g. "gcp__search_logs"
  inputArgs: jsonb('input_args').notNull(),
  outputData: jsonb('output_data'),
  outputSummary: text('output_summary'),              // Fast LLM review text
  cacheHit: boolean('cache_hit').default(false).notNull(),
  costEstimateUsd: numeric('cost_estimate_usd', { precision: 8, scale: 4 }).default('0.0000'),
  durationMs: numeric('duration_ms').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  sessionTimelineIdx: index('session_timeline_idx').on(table.sessionId, table.createdAt),
}));

// 7. Immutable Enterprise Audit Logs
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id').references(() => teams.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  sessionId: uuid('session_id').references(() => investigationSessions.id),
  action: text('action').notNull(),                   // 'CALL_TOOL' | 'CREATE_SESSION' | 'AUTH'
  resourceName: text('resource_name').notNull(),      // 'gcp', 'sentry', etc.
  metadata: jsonb('metadata').notNull(),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

---

## 4. Substrate Middleware Composition Engine

File: `packages/core/src/middleware/compose.ts`

```typescript
export interface RequestContext {
  teamId: string;
  userId: string;
  sessionId?: string;
  clientName: string;
}

export type ToolHandler = (name: string, args: Record<string, unknown>, ctx: RequestContext) => Promise<unknown>;
export type Middleware = (next: ToolHandler) => ToolHandler;

export function composeMiddleware(...middlewares: Middleware[]): (base: ToolHandler) => ToolHandler {
  return (baseHandler: ToolHandler) => {
    return middlewares.reduceRight((wrapped, middleware) => middleware(wrapped), baseHandler);
  };
}
```

### 4.1 Schema Partitioning Middleware (Airis Algorithm)
File: `packages/core/src/middleware/schema-partition.ts`

```typescript
import { ZodSchema, z } from 'zod';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any; // JSON Schema
}

/**
 * Strips nested properties from JSON schema on tools/list to save 85-90% of token context.
 */
export function partitionSchema(fullSchema: any): any {
  if (!fullSchema || fullSchema.type !== 'object' || !fullSchema.properties) {
    return fullSchema;
  }

  const topLevelProperties: Record<string, any> = {};
  for (const [key, value] of Object.entries<any>(fullSchema.properties)) {
    topLevelProperties[key] = {
      type: value.type,
      description: value.description,
      ...(value.enum ? { enum: value.enum } : {}),
      ...(value.default !== undefined ? { default: value.default } : {}),
    };
  }

  return {
    type: 'object',
    properties: topLevelProperties,
    required: fullSchema.required || [],
  };
}
```

### 4.2 In-Flight PII / Secret Masking Middleware
File: `packages/core/src/middleware/pii-redactor.ts`

```typescript
const SENSITIVE_PATTERNS = [
  /(?:bearer\s+[a-zA-Z0-9_\-\.]{20,})/gi,
  /(?:AIza[0-9A-Za-z\-_]{35})/g,                      // Google API Key
  /(?:ghp_[0-9a-zA-Z]{36})/g,                         // GitHub Personal Token
  /(?:sntrys_[a-zA-Z0-9]{64})/g,                      // Sentry Token
  /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, // Email Address
  /\b(?:\d{4}[ -]?){3}\d{4}\b/g,                      // Credit Card
];

export function redactString(input: string): string {
  let output = input;
  for (const pattern of SENSITIVE_PATTERNS) {
    output = output.replace(pattern, '[REDACTED_SECRET]');
  }
  return output;
}

export function redactObject(obj: any): any {
  if (typeof obj === 'string') return redactString(obj);
  if (Array.isArray(obj)) return obj.map(redactObject);
  if (obj !== null && typeof obj === 'object') {
    const redacted: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      redacted[k] = redactObject(v);
    }
    return redacted;
  }
  return obj;
}
```

---

## 5. STDIO Subprocess Pool & JSON-RPC Multiplexing

File: `packages/core/src/pool/server-pool.ts`

```typescript
import { spawn, ChildProcess } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

interface PooledServer {
  process: ChildProcess;
  client: Client;
  transport: StdioClientTransport;
  inFlightCount: number;
  lastUsedAt: number;
}

export class SubprocessPool {
  private pool = new Map<string, PooledServer>();
  private readonly MAX_CONCURRENCY_PER_PROCESS = 32;

  private getPoolKey(teamId: string, connectorName: string): string {
    return `${teamId}:${connectorName}`;
  }

  async acquire(teamId: string, connectorName: string, command: string, args: string[], env: Record<string, string>): Promise<Client> {
    const key = this.getPoolKey(teamId, connectorName);
    let entry = this.pool.get(key);

    if (!entry || entry.process.killed || entry.inFlightCount >= this.MAX_CONCURRENCY_PER_PROCESS) {
      entry = await this.spawnInstance(command, args, env);
      this.pool.set(key, entry);
    }

    entry.inFlightCount++;
    entry.lastUsedAt = Date.now();
    return entry.client;
  }

  release(teamId: string, connectorName: string) {
    const key = this.getPoolKey(teamId, connectorName);
    const entry = this.pool.get(key);
    if (entry && entry.inFlightCount > 0) {
      entry.inFlightCount--;
      entry.lastUsedAt = Date.now();
    }
  }

  private async spawnInstance(command: string, args: string[], env: Record<string, string>): Promise<PooledServer> {
    const transport = new StdioClientTransport({
      command,
      args,
      env: { ...process.env, ...env },
    });

    const client = new Client({
      name: `parallax-aggregator`,
      version: '1.0.0',
    }, {
      capabilities: {}
    });

    await client.connect(transport);

    // Retrieve underlying child process for health checks
    const childProc = (transport as any)._process as ChildProcess;

    return {
      process: childProc,
      client,
      transport,
      inFlightCount: 0,
      lastUsedAt: Date.now(),
    };
  }

  async shutdown() {
    for (const [key, server] of this.pool.entries()) {
      try {
        await server.client.close();
        server.process.kill('SIGTERM');
      } catch (e) {
        server.process.kill('SIGKILL');
      }
    }
    this.pool.clear();
  }
}
```

---

## 6. The Connector Triple Implementation

### 6.1 Connector Context Abstraction
File: `packages/connector-sdk/src/context.ts`

```typescript
import { Redis } from 'ioredis';

export interface ConnectorContext {
  teamId: string;
  getCredentials(): Promise<Record<string, string>>;
  cache: Redis;
  recordEvent(event: { toolName: string; args: any; result: any; durationMs: number }): Promise<void>;
}
```

### 6.2 GCP Observability Connector (`connector-gcp`)
File: `packages/connector-gcp/src/index.ts`

```typescript
import { Logging } from '@google-cloud/logging';
import { ConnectorContext } from '@parallax/connector-sdk';

export class GcpConnector {
  readonly name = 'gcp';

  async searchLogs(args: { filter: string; limit?: number; minutes?: number }, ctx: ConnectorContext) {
    const creds = await ctx.getCredentials();
    const logging = new Logging({
      credentials: JSON.parse(creds.GCP_SERVICE_ACCOUNT_KEY),
      projectId: creds.GCP_PROJECT_ID,
    });

    const windowMinutes = args.minutes || 15;
    const startTime = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
    const fullFilter = `timestamp >= "${startTime}" AND ${args.filter}`;

    const [entries] = await logging.getEntries({
      filter: fullFilter,
      pageSize: args.limit || 50,
      orderBy: 'timestamp desc',
    });

    return {
      _source: 'gcp',
      time_window: `${startTime} → ${new Date().toISOString()}`,
      count: entries.length,
      logs: entries.map(e => ({
        timestamp: e.metadata.timestamp,
        severity: e.metadata.severity,
        payload: e.data,
        resource: e.metadata.resource,
      })),
    };
  }
}
```

### 6.3 Sentry Connector (`connector-sentry`)
File: `packages/connector-sentry/src/index.ts`

```typescript
import { ConnectorContext } from '@parallax/connector-sdk';

export class SentryConnector {
  readonly name = 'sentry';

  async searchIssues(args: { query: string; minutes?: number }, ctx: ConnectorContext) {
    const creds = await ctx.getCredentials();
    const org = creds.SENTRY_ORG;
    const url = `https://sentry.io/api/0/organizations/${org}/issues/?query=${encodeURIComponent(args.query)}`;

    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${creds.SENTRY_AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      }
    });

    if (!res.ok) {
      throw new Error(`Sentry API returned ${res.status}: ${await res.text()}`);
    }

    const issues = await res.json();
    return {
      _source: 'sentry',
      count: issues.length,
      issues: issues.map((i: any) => ({
        id: i.id,
        shortId: i.shortId,
        title: i.title,
        culprit: i.culprit,
        count: i.count,
        userCount: i.userCount,
        lastSeen: i.lastSeen,
        permalink: i.permalink,
      })),
    };
  }
}
```

### 6.4 GitHub Connector (`connector-github`)
File: `packages/connector-github/src/index.ts`

```typescript
import { Octokit } from '@octokit/rest';
import { ConnectorContext } from '@parallax/connector-sdk';

export class GithubConnector {
  readonly name = 'github';

  async listDeployments(args: { repo: string; owner: string; minutes?: number }, ctx: ConnectorContext) {
    const creds = await ctx.getCredentials();
    const octokit = new Octokit({ auth: creds.GITHUB_TOKEN });

    const { data: deploys } = await octokit.rest.repos.listDeployments({
      owner: args.owner,
      repo: args.repo,
      per_page: 10,
    });

    return {
      _source: 'github',
      deployments: deploys.map(d => ({
        id: d.id,
        environment: d.environment,
        ref: d.ref,
        sha: d.sha,
        createdAt: d.created_at,
        creator: d.creator?.login,
      })),
    };
  }
}
```

---

## 7. Multi-Engineer Investigation Plugin (`packages/plugin-investigation`)

### 7.1 Tools Registry & Shared Session Coordination
File: `packages/plugin-investigation/src/tools.ts`

```typescript
import { db } from '@parallax/core/storage/db';
import { investigationSessions, sessionParticipants, sessionEvents, users } from '@parallax/core/storage/schema';
import { eq, and, desc, gte } from 'drizzle-orm';

export const investigationTools = {
  // 1. Create Session
  async createSession(args: { incident_id: string; title: string }, ctx: { teamId: string; userId: string }) {
    const [session] = await db.insert(investigationSessions).values({
      teamId: ctx.teamId,
      incidentId: args.incident_id,
      title: args.title,
      createdByUserId: ctx.userId,
    }).returning();

    await db.insert(sessionParticipants).values({
      sessionId: session.id,
      userId: ctx.userId,
    });

    return {
      session_id: session.id,
      incident_id: session.incidentId,
      title: session.title,
      status: 'active',
      message: `Investigation session started. Other engineers can join using session_id: ${session.id}`,
    };
  },

  // 2. Join Existing Session
  async joinSession(args: { session_id: string }, ctx: { userId: string }) {
    const [session] = await db.select().from(investigationSessions).where(eq(investigationSessions.id, args.session_id));
    if (!session) throw new Error(`Session ${args.session_id} not found`);

    await db.insert(sessionParticipants).values({
      sessionId: session.id,
      userId: ctx.userId,
    }).onConflictDoNothing();

    return {
      session_id: session.id,
      incident_id: session.incidentId,
      title: session.title,
      joined: true,
      message: `Successfully joined shared investigation session ${session.id}. All your queries will be recorded and correlated with team members.`,
    };
  },

  // 3. Multi-Engineer Awareness (Co-pilot sync)
  async getSessionActivity(args: { session_id: string; limit?: number; since_timestamp?: string }, ctx: any) {
    let query = db.select({
      id: sessionEvents.id,
      userName: users.name,
      toolName: sessionEvents.toolName,
      inputArgs: sessionEvents.inputArgs,
      outputSummary: sessionEvents.outputSummary,
      cacheHit: sessionEvents.cacheHit,
      createdAt: sessionEvents.createdAt,
    })
    .from(sessionEvents)
    .innerJoin(users, eq(sessionEvents.userId, users.id))
    .where(eq(sessionEvents.sessionId, args.session_id))
    .orderBy(desc(sessionEvents.createdAt))
    .limit(args.limit || 15);

    const events = await query;
    return {
      session_id: args.session_id,
      total_retrieved: events.length,
      activity: events.reverse(), // Return in chronological order
    };
  },

  // 4. Close Session & Synthesize Postmortem
  async closeSession(args: { session_id: string; verdict: string }, ctx: { userId: string }) {
    const [session] = await db.select().from(investigationSessions).where(eq(investigationSessions.id, args.session_id));
    if (!session) throw new Error(`Session ${args.session_id} not found`);

    const allEvents = await db.select({
      userName: users.name,
      toolName: sessionEvents.toolName,
      summary: sessionEvents.outputSummary,
      args: sessionEvents.inputArgs,
      cacheHit: sessionEvents.cacheHit,
      createdAt: sessionEvents.createdAt,
    })
    .from(sessionEvents)
    .innerJoin(users, eq(sessionEvents.userId, users.id))
    .where(eq(sessionEvents.sessionId, args.session_id))
    .orderBy(sessionEvents.createdAt);

    // Generate Living Markdown Postmortem
    const postmortemMd = `
# Incident Postmortem: ${session.title} (${session.incidentId})

**Status:** Resolved  
**Closed At:** ${new Date().toISOString()}  
**Lead Verdict:** ${args.verdict}  

## Investigation Timeline
${allEvents.map(e => `- **${e.createdAt.toISOString().slice(11, 19)} UTC** [${e.userName}]: Called \`${e.toolName}\` → ${e.summary || 'Executed'}`).join('\n')}

## Metrics & Efficiency
- **Total Diagnostic Queries:** ${allEvents.length}
- **Queries Served from Cache:** ${allEvents.filter(e => e.cacheHit).length} (${Math.round((allEvents.filter(e => e.cacheHit).length / (allEvents.length || 1)) * 100)}%)
    `.trim();

    await db.update(investigationSessions).set({
      status: 'closed',
      verdict: args.verdict,
      postmortemMarkdown: postmortemMd,
      closedAt: new Date(),
    }).where(eq(investigationSessions.id, args.session_id));

    return {
      session_id: args.session_id,
      status: 'closed',
      postmortem: postmortemMd,
    };
  },
};
```

---

## 8. Fastify Outer Shell & MCP HTTP Transport

File: `packages/core/src/server.ts`

```typescript
import Fastify from 'fastify';
import { StreamableHttpTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { composeMiddleware } from './middleware/compose.js';
import { partitionSchema } from './middleware/schema-partition.js';
import { redactObject } from './middleware/pii-redactor.js';

export async function createServer() {
  const app = Fastify({ logger: true });

  const mcp = new McpServer({
    name: 'parallax-server',
    version: '1.0.0',
  });

  // Health checks
  app.get('/health', async () => ({ status: 'healthy', timestamp: new Date() }));
  app.get('/ready', async () => ({ status: 'ready' }));

  // OAuth 2.1 RFC 9728 discovery endpoint
  app.get('/.well-known/oauth-protected-resource', async () => ({
    resource: 'https://api.parallax.dev/mcp',
    authorization_servers: ['https://api.parallax.dev/oauth'],
    scopes_supported: ['investigation:read', 'investigation:write'],
    bearer_methods_supported: ['header'],
  }));

  // Mount MCP Streamable HTTP endpoint
  app.all('/mcp', async (req, reply) => {
    // In Fastify, forward request to MCP SDK Streamable HTTP transport
    const transport = new StreamableHttpTransport();
    await mcp.connect(transport);
    await transport.handleRequest(req.raw, reply.raw);
  });

  return app;
}
```

---

## 9. Four-Week Step-by-Step Engineering Execution Roadmap

```
  WEEK 1                    WEEK 2                    WEEK 3                    WEEK 4
┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────────┐
│ • pnpm Monorepo Setup │ │ • STDIO Subprocess    │ │ • Investigation Plugin│ │ • 2-Engineer Dual IDE │
│ • Docker Compose (PG  │ │   Pool Engine         │ │   (Create, Join, Sync)│   Verification (Cursor│
│   16 & Redis 7.x)     │ │ • GCP Logging SDK     │ │ • Cross-Vendor        │   + Claude Code)      │
│ • Drizzle Schema &    │ │ • Sentry Connector    │   Correlation Engine    │ • Living Postmortem   │
│   Migrations          │ │ • GitHub Connector    │ │ • Redis Shared Cache  │   Export Verification │
│ • Fastify /mcp route  │ │ • Schema Partitioning │ │ • PII Redaction Mask  │ • Load & Smoke Testing│
└───────────────────────┘ └───────────────────────┘ └───────────────────────┘ └───────────────────────┘
```

### Detailed Task Breakdown:

#### **Week 1: Infrastructure, Storage & Gateway Edge**
- [ ] Task 1.1: Initialize pnpm monorepo with `packages/core`, `packages/connector-sdk`, `packages/auth`, and `packages/plugin-investigation`.
- [ ] Task 1.2: Write `docker-compose.yml` defining PostgreSQL 16 and Redis 7.x with pre-configured health checks.
- [ ] Task 1.3: Define Drizzle schemas (`teams`, `users`, `connector_credentials`, `investigation_sessions`, `session_events`, `audit_logs`). Run migrations.
- [ ] Task 1.4: Implement Fastify outer shell, `/health`, `/.well-known/oauth-protected-resource`, and mount `@modelcontextprotocol/sdk` Streamable HTTP handler.
- [ ] Task 1.5: Define mode-agnostic `ConnectorContext` interface.

#### **Week 2: Subprocess Pool & The MVP Connector Triple**
- [ ] Task 2.1: Build `SubprocessPool` managing child processes over STDIO with JSON-RPC ID multiplexing and max concurrency caps.
- [ ] Task 2.2: Implement `connector-gcp` wrapping Google Cloud Logging & Trace with service account authentication.
- [ ] Task 2.3: Implement `connector-sentry` querying Sentry REST/MCP for issues, stack traces, and frequency.
- [ ] Task 2.4: Implement `connector-github` querying GitHub deployments, commit history, and PRs.
- [ ] Task 2.5: Implement Airis-style schema partitioning middleware to strip nested parameters on `tools/list` and expose `expand_schema`.

#### **Week 3: Multi-Engineer Collaboration & Correlation Engine**
- [ ] Task 3.1: Build `investigation__create_session`, `investigation__join_session`, and `investigation__list_open_sessions`.
- [ ] Task 3.2: Implement `investigation__get_session_activity` to enable co-pilot synchronization across different engineers' IDEs.
- [ ] Task 3.3: Implement Time-Window Cross-Vendor Correlation Middleware (`_correlation` metadata block).
- [ ] Task 3.4: Implement content-addressable Redis caching middleware for query deduplication.
- [ ] Task 3.5: Implement PII and Secret masking regex middleware.

#### **Week 4: End-to-End Integration, Dual-Client Testing & Hardening**
- [ ] Task 4.1: Run a live multi-engineer test: Engineer 1 (Cursor) creates a session; Engineer 2 (Claude Code) joins the session.
- [ ] Task 4.2: Verify that GCP log query from Engineer 1 is cached in Redis and served in 0ms to Engineer 2.
- [ ] Task 4.3: Verify that Sentry error spikes automatically correlate with recent GitHub commits in the `_correlation` payload.
- [ ] Task 4.4: Call `investigation__close_session` and verify complete Markdown postmortem generation.
- [ ] Task 4.5: Document setup instructions in `docs/install/` for Cursor, Claude Code, Antigravity, and Windsurf.

---

## 10. Local Development Quickstart (The "30-Minute Principle")

Every developer should have a working local environment in under 15 minutes:

```bash
# 1. Clone & Install Dependencies
git clone <repo-url> parallax && cd parallax
pnpm install

# 2. Start PostgreSQL 16 and Redis 7.x
cp .env.example .env
docker compose up -d

# 3. Run Database Migrations & Seed Data
pnpm db:migrate
pnpm db:seed

# 4. Start Parallax in Dev Mode
pnpm dev

# 5. Connect Cursor / Claude Code
# Add to ~/.cursor/mcp.json or claude_desktop_config.json:
# {
#   "mcpServers": {
#     "parallax": {
#       "url": "http://localhost:3000/mcp"
#     }
#   }
# }
```