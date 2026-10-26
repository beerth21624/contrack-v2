// ─── PostgreSQL tables: subcontracting, shared by its work streams (activity log) ───
import { bigserial, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { workspaces } from './schema';

/** Every state change of the subcontracting module: who, when, what (plan §6 rule 14). */
export const scActivity = pgTable('sc_activity', {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    buyerWorkspaceId: uuid('buyer_workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    vendorWorkspaceId: uuid('vendor_workspace_id'),
    entity: text('entity', { enum: ['package', 'invitation', 'bid', 'subcontract', 'claim', 'variation', 'vendor'] }).notNull(),
    entityId: uuid('entity_id').notNull(),
    action: text('action').notNull(),
    actorUserId: uuid('actor_user_id'),
    data: jsonb('data').$type<Record<string, unknown>>(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
    index('sc_activity_entity_idx').on(t.entity, t.entityId, t.id),
    index('sc_activity_buyer_idx').on(t.buyerWorkspaceId, t.id),
]);

export const scSharedTables = { scActivity };
