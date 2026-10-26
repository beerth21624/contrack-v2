import { defineConfig } from 'drizzle-kit';

// `npm run db:generate` writes SQL migrations to ./drizzle from the schema (no database needed).
export default defineConfig({
    dialect: 'postgresql',
    schema: './src/shared/infrastructure/database/schema.ts',
    out: './drizzle',
    dbCredentials: { url: process.env.DATABASE_URL ?? 'postgres://contrack:contrack@localhost:5432/contrack' },
    strict: true,
    verbose: true,
});
