import { db } from './db.js';
import { teams, users, connectorCredentials } from './schema.js';
import { eq } from 'drizzle-orm';
import { encryptPayload } from './crypto.js';
import { runMigrations } from './migrate.js';

export async function seedDatabase() {
  await runMigrations();
  console.log('[Storage] Seeding database with initial team and engineers...');

  // 1. Create or get Team
  let [team] = await db.select().from(teams);
  if (!team) {
    [team] = await db.insert(teams).values({
      name: 'Acme Payments Corp',
      slug: 'acme-payments',
    }).returning();
  }

  // 2. Create Alice (Cursor engineer)
  let [alice] = await db.select().from(users).where(eq(users.email, 'alice@acme.corp'));
  if (!alice) {
    [alice] = await db.insert(users).values({
      teamId: team.id,
      email: 'alice@acme.corp',
      name: 'Alice (Lead SRE - Cursor)',
      token: 'user_alice_cursor',
      role: 'engineer',
    }).returning();
  }

  // 3. Create Bob (Claude Code engineer)
  let [bob] = await db.select().from(users).where(eq(users.email, 'bob@acme.corp'));
  if (!bob) {
    [bob] = await db.insert(users).values({
      teamId: team.id,
      email: 'bob@acme.corp',
      name: 'Bob (Staff SRE - Claude Code)',
      token: 'user_bob_claude',
      role: 'engineer',
    }).returning();
  }

  // 4. Seed encrypted connector credentials
  const gcpPayload = encryptPayload({
    GCP_PROJECT_ID: process.env.GCP_PROJECT_ID || 'acme-payments-prod',
    GCP_SERVICE_ACCOUNT_KEY: process.env.GCP_SERVICE_ACCOUNT_KEY || JSON.stringify({ type: 'service_account', project_id: 'acme-payments-prod' }),
  });

  const sentryPayload = encryptPayload({
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN || 'sntrys_mock_token_12345678',
    SENTRY_ORG: process.env.SENTRY_ORG || 'acme-payments',
  });

  const githubPayload = encryptPayload({
    GITHUB_TOKEN: process.env.GITHUB_TOKEN || 'ghp_mock_token_12345678',
  });

  await db.insert(connectorCredentials).values([
    {
      teamId: team.id,
      connectorName: 'gcp',
      providerType: 'static_json',
      scopeType: 'team_shared',
      encryptedPayload: gcpPayload.encryptedPayload,
      iv: gcpPayload.iv,
      tag: gcpPayload.tag,
      initiatedByUserId: alice.id,
    },
    {
      teamId: team.id,
      connectorName: 'sentry',
      providerType: 'api_key',
      scopeType: 'team_shared',
      encryptedPayload: sentryPayload.encryptedPayload,
      iv: sentryPayload.iv,
      tag: sentryPayload.tag,
      initiatedByUserId: alice.id,
    },
    {
      teamId: team.id,
      connectorName: 'github',
      providerType: 'api_key',
      scopeType: 'team_shared',
      encryptedPayload: githubPayload.encryptedPayload,
      iv: githubPayload.iv,
      tag: githubPayload.tag,
      initiatedByUserId: alice.id,
    },
  ]).onConflictDoNothing();

  console.log('[Storage] Database seeding complete.');
  console.log('  -> Team:', team.name);
  console.log('  -> Alice Token (Cursor): user_alice_cursor');
  console.log('  -> Bob Token (Claude Code): user_bob_claude');
}

if (process.argv[1]?.endsWith('seed.ts')) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Storage] Seeding failed:', err);
      process.exit(1);
    });
}
