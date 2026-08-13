/**
 * Supabase Postgres + Drizzle client (postgres-js driver).
 *
 * Connection string: from Supabase Dashboard → Project Settings → Database →
 * "Connection string". For the app + drizzle-kit, the **Session mode / direct**
 * string (port 5432) works everywhere. `prepare:false` is set so the same code
 * also works with the Supabase transaction pooler (port 6543) at scale.
 */
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and add your Supabase connection string.",
  );
}

const client = postgres(connectionString, {
  max: 10,
  prepare: false, // required for pgbouncer/transaction pooler; harmless for direct
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: "prefer",
});

export const db = drizzle({ client, schema });
export { schema };
