import { pgTable, uuid, text, timestamp, boolean, jsonb, numeric, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// 1. Teams
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
  token: text('token').notNull().unique(), // Bearer API token
  role: text('role').notNull().default('engineer'), // 'admin' | 'engineer'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 3. Connector Credentials (Encrypted at Rest)
export const connectorCredentials = pgTable('connector_credentials', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id').references(() => teams.id).notNull(),
  userId: uuid('user_id').references(() => users.id), // NULL = team-shared
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

// 4. Investigation Sessions
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

// 5. Session Participants (Multi-Engineer War Room)
export const sessionParticipants = pgTable('session_participants', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => investigationSessions.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
  lastSeenAt: timestamp('last_seen_at').defaultNow().notNull(),
}, (table) => ({
  sessionUserIdx: index('session_user_idx').on(table.sessionId, table.userId),
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
  durationMs: numeric('duration_ms').default('0').notNull(),
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
