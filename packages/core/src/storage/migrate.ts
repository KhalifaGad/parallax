import { sqlClient } from './db.js';

export async function runMigrations() {
  console.log('[Storage] Running database migrations...');
  
  await sqlClient.unsafe(`
    CREATE TABLE IF NOT EXISTS teams (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL DEFAULT 'engineer',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS connector_credentials (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      connector_name TEXT NOT NULL,
      provider_type TEXT NOT NULL,
      scope_type TEXT NOT NULL DEFAULT 'team_shared',
      encrypted_payload TEXT NOT NULL,
      iv TEXT NOT NULL,
      tag TEXT NOT NULL,
      initiated_by_user_id UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS investigation_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      incident_id TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_by_user_id UUID NOT NULL REFERENCES users(id),
      verdict TEXT,
      postmortem_markdown TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      closed_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS session_participants (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES investigation_sessions(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    ALTER TABLE session_participants ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();

    CREATE TABLE IF NOT EXISTS session_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES investigation_sessions(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id),
      tool_name TEXT NOT NULL,
      input_args JSONB NOT NULL,
      output_data JSONB,
      output_summary TEXT,
      cache_hit BOOLEAN NOT NULL DEFAULT false,
      cost_estimate_usd NUMERIC(8,4) DEFAULT '0.0000',
      duration_ms NUMERIC NOT NULL DEFAULT '0',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id),
      session_id UUID REFERENCES investigation_sessions(id),
      action TEXT NOT NULL,
      resource_name TEXT NOT NULL,
      metadata JSONB NOT NULL,
      ip_address TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS team_connector_idx ON connector_credentials (team_id, connector_name);
    CREATE INDEX IF NOT EXISTS team_incident_idx ON investigation_sessions (team_id, incident_id);
    CREATE INDEX IF NOT EXISTS session_timeline_idx ON session_events (session_id, created_at);
  `);

  console.log('[Storage] Migrations applied successfully.');
}

if (process.argv[1]?.endsWith('migrate.ts')) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Storage] Migration failed:', err);
      process.exit(1);
    });
}
