import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema.js';
import dotenv from 'dotenv';
import { resolve } from 'node:path';

// Load .env from cwd or root
dotenv.config();
dotenv.config({ path: resolve(process.cwd(), '../../.env') });
dotenv.config({ path: resolve(process.cwd(), '.env') });

const connectionString = process.env.DATABASE_URL || 'postgresql://parallax:parallax_secret_password@localhost:5435/parallax_db';

export const sqlClient = postgres(connectionString, {
  max: 20,
  idle_timeout: 30,
  connect_timeout: 10,
});

export const db = drizzle(sqlClient, { schema });
