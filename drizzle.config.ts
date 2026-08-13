/**
 * drizzle-kit config — generates SQL migrations from schema.ts.
 *   npm run db:generate   → create migration
 *   npm run db:migrate    → apply migration (requires DATABASE_URL)
 *   npm run db:push       → sync schema directly (dev only)
 */
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
