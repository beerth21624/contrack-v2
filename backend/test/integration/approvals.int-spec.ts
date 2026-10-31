// ─── Integration: approvals + audit Drizzle adapters on PostgreSQL (partial unique of pending, lists, rollback) ───
import { randomUUID } from 'node:crypto';
import { DrizzleApprovalPolicyRepository } from '../../src/modules/approvals/infrastructure/adapters/drizzle-approval-policy.repository';
import { DrizzleApprovalRequestRepository } from '../../src/modules/approvals/infrastructure/adapters/drizzle-approval-request.repository';
import { asApprovalRequestId, asApprovalStepId } from '../../src/modules/approvals/domain/approvals-ids';
import { ApprovalRequest, type NewApprovalRequest } from '../../src/modules/approvals/domain/entities/approval-request.entity';
import { DrizzleAuditEventRepository } from '../../src/modules/audit/infrastructure/adapters/drizzle-audit-event.repository';
import type { UserId, WorkspaceId } from '../../src/shared/domain/ids';
import { DrizzleUnitOfWork } from '../../src/shared/infrastructure/database/database';
import { describeIfDatabase, skipIfNoDatabase } from '../support/database';
import { T0, seedMember, seedProject, seedUser, seedWorkspace } from '../support/seed';

const at = (ms: number): Date => new Date(T0.getTime() + ms);

function fresh(ws: WorkspaceId, by: UserId, subjectId: string, now: Date, projectId: NewApprovalRequest['projectId'] = null): NewApprovalRequest {
    return {
        id: asApprovalRequestId(randomUUID()), workspaceId: ws, projectId, subject: 'purchase_order.issue', subjectId, title: 'PO ทดสอบ',
        amount: 60_000.5, requestedBy: by, now,
    };
}

describeIfDatabase('approvals + audit (integration)', db => {
    it('stores a pending request with its step; a second pending of the same document is refused', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const repo = new DrizzleApprovalRequestRepository(ctx);
        const owner = await seedUser(ctx);
        const ws = await seedWorkspace(ctx, owner);
        const project = await seedProject(ctx, ws, owner);
        const doc = randomUUID();
        const first = ApprovalRequest.pending(fresh(ws, owner, doc, T0, project.id), asApprovalStepId(randomUUID()), ['owner', 'pm']);
        expect(await repo.insert(first)).toBe(true);
        expect((await repo.findById(first.id))?.toProps()).toEqual(first.toProps());
        expect(await repo.insert(ApprovalRequest.pending(fresh(ws, owner, doc, at(1)), asApprovalStepId(randomUUID()), ['owner']))).toBe(false);
        // an automatic approval of the same document is not blocked by the index
        expect(await repo.insert(ApprovalRequest.autoApproved(fresh(ws, owner, doc, at(2)), 'solo'))).toBe(true);
        expect((await repo.findPending(ws, 'purchase_order.issue', doc))?.id).toBe(first.id);
        expect((await repo.latestOf(ws, 'purchase_order.issue', doc))?.status).toBe('approved');
    });

    it('decides under a row lock, lists by role / visibility with a cursor, scoped by workspace', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const repo = new DrizzleApprovalRequestRepository(ctx);
        const uow = new DrizzleUnitOfWork(ctx);
        const owner = await seedUser(ctx);
        const estimator = await seedUser(ctx);
        const ws = await seedWorkspace(ctx, owner);
        await seedMember(ctx, ws, estimator, 'estimator');
        const other = await seedWorkspace(ctx, owner);
        const a = ApprovalRequest.pending(fresh(ws, estimator, randomUUID(), T0), asApprovalStepId(randomUUID()), ['owner', 'pm']);
        const b = ApprovalRequest.pending(fresh(ws, estimator, randomUUID(), at(1000)), asApprovalStepId(randomUUID()), ['owner']);
        const c = ApprovalRequest.autoApproved(fresh(ws, owner, randomUUID(), at(2000)), 'policy_off');
        for (const r of [a, b, c]) await repo.insert(r);

        expect((await repo.list(ws, { pendingForRole: 'pm', limit: 10 })).map(r => r.id)).toEqual([a.id]);
        expect((await repo.list(ws, { pendingForRole: 'owner', limit: 10 })).map(r => r.id)).toEqual([b.id, a.id]);
        expect((await repo.list(ws, { visibleTo: { userId: owner, role: 'viewer' }, limit: 10 })).map(r => r.id)).toEqual([c.id]);
        const page1 = await repo.list(ws, { limit: 2 });
        expect(page1.map(r => r.id)).toEqual([c.id, b.id]);
        const last = page1[1]?.toProps();
        expect((await repo.list(ws, { limit: 2, before: last === undefined ? undefined : { requestedAt: last.requestedAt, id: last.id } })).map(r => r.id))
            .toEqual([a.id]);
        expect(await repo.list(other, { limit: 10 })).toEqual([]);
        expect(await repo.lockForUpdate(other, a.id)).toBeUndefined();

        await uow.run(async () => {
            const locked = await repo.lockForUpdate(ws, a.id);
            if (locked === undefined) throw new Error('missing');
            expect(locked.decide('rejected', owner, 'แพงไป', at(3000)).ok).toBe(true);
            await repo.update(locked);
        });
        const decided = await repo.findById(a.id);
        expect(decided?.toProps()).toMatchObject({ status: 'rejected', decidedBy: owner, decisionNote: 'แพงไป', steps: [{ status: 'rejected', note: 'แพงไป' }] });
    });

    it('a throw inside the transaction rolls the decision back', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const repo = new DrizzleApprovalRequestRepository(ctx);
        const owner = await seedUser(ctx);
        const ws = await seedWorkspace(ctx, owner);
        const r = ApprovalRequest.pending(fresh(ws, owner, randomUUID(), T0), asApprovalStepId(randomUUID()), ['owner']);
        await repo.insert(r);
        await expect(new DrizzleUnitOfWork(ctx).run(async () => {
            const locked = await repo.lockForUpdate(ws, r.id);
            locked?.decide('approved', owner, '', at(1));
            if (locked !== undefined) await repo.update(locked);
            throw new Error('handler refused');
        })).rejects.toThrow('handler refused');
        expect((await repo.findById(r.id))?.status).toBe('pending');
    });

    it('policies upsert; audit is append-only, filtered and paged by id', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const owner = await seedUser(ctx);
        const ws = await seedWorkspace(ctx, owner);
        const policies = new DrizzleApprovalPolicyRepository(ctx);
        const p = { subject: 'quotation.issue' as const, enabled: true, minAmount: 1000.25, approverRoles: ['owner' as const], selfApprove: false, updatedBy: owner, updatedAt: T0 };
        await policies.save(ws, p);
        await policies.save(ws, { ...p, minAmount: null, updatedAt: at(1) });
        expect(await policies.listByWorkspace(ws)).toEqual([{ ...p, minAmount: null, updatedAt: at(1) }]);

        const audit = new DrizzleAuditEventRepository(ctx);
        for (let i = 0; i < 3; i += 1) {
            await audit.append({ workspaceId: ws, projectId: null, actor: owner, entityType: 'x', entityId: `e${i % 2}`, action: 'set', data: { n: i } }, at(i));
        }
        const all = await audit.list(ws, { limit: 10 });
        expect(all.map(e => e.data)).toEqual([{ n: 2 }, { n: 1 }, { n: 0 }]);
        expect((await audit.list(ws, { entityType: 'x', entityId: 'e0', limit: 10 })).map(e => e.data)).toEqual([{ n: 2 }, { n: 0 }]);
        expect((await audit.list(ws, { before: all[0]?.id, limit: 1 })).map(e => e.data)).toEqual([{ n: 1 }]);
    });
});
