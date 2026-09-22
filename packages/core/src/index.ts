import { createServer } from './server.js';
import { runMigrations } from './storage/migrate.js';
import { seedDatabase } from './storage/seed.js';
import dotenv from 'dotenv';

dotenv.config();

process.on('uncaughtException', (err) => {
  console.warn('[Parallax Server] Recovered from uncaught exception:', err.message);
});

process.on('unhandledRejection', (reason: any) => {
  console.warn('[Parallax Server] Recovered from unhandled rejection:', reason?.message || reason);
});

const port = Number(process.env.PORT) || 3100;
const host = process.env.HOST || '0.0.0.0';

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   PARALLAX — Collaborative Investigation Layer for MCP    ');
  console.log('═══════════════════════════════════════════════════════════');

  try {
    // Auto-migrate and seed on startup
    await runMigrations();
    await seedDatabase();

    const server = await createServer();
    await server.listen({ port, host });

    console.log(`[Parallax Server] Listening on http://${host}:${port}`);
    console.log(`[Parallax Server] MCP Streamable HTTP endpoint: http://localhost:${port}/mcp`);
    console.log(`[Parallax Server] Ready for connections from Cursor & Claude Code.`);
  } catch (err) {
    console.error('[Parallax Server] Fatal startup error:', err);
    process.exit(1);
  }
}

main();
