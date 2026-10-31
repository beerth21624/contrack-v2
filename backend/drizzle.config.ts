import { defineConfig } from 'drizzle-kit';

// `npm run db:generate` writes SQL migrations to ./drizzle from the schema (no database needed).
export default defineConfig({
    dialect: 'postgresql',
    schema: [
        './src/shared/infrastructure/database/schema.ts',
        './src/shared/infrastructure/database/schema-identity-phone.ts',
        './src/shared/infrastructure/database/schema-platform.ts',
        './src/shared/infrastructure/database/schema-sc-shared.ts',
        './src/shared/infrastructure/database/schema-sc-sourcing.ts',
        './src/shared/infrastructure/database/schema-sc-bidding.ts',
        './src/shared/infrastructure/database/schema-sc-contracts.ts',
        './src/shared/infrastructure/database/schema-erp-core.ts',
        './src/shared/infrastructure/database/schema-boq-control.ts',
        './src/shared/infrastructure/database/schema-ledger.ts',
        './src/shared/infrastructure/database/schema-quotations.ts',
        './src/shared/infrastructure/database/schema-contracts-billing.ts',
        './src/shared/infrastructure/database/schema-variations.ts',
        './src/shared/infrastructure/database/schema-procurement.ts',
    ],
    out: './drizzle',
    dbCredentials: { url: process.env.DATABASE_URL ?? 'postgres://contrack:contrack@localhost:5432/contrack' },
    strict: true,
    verbose: true,
});
