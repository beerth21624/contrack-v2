import type { ApprovalSubject } from '@contrack/contract';
import { ModuleAccess } from '../../../../shared/application/module-access';
import {
    type ApprovalDecidedEvent, ApprovalHandlers, type ApprovalRequestInput, type UserProfile, UserDirectory,
} from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import { type UserId, type WorkspaceId, asUserId, asWorkspaceId } from '../../../../shared/domain/ids';
import { err, okVoid } from '../../../../shared/domain/result';
import { InMemoryUnitOfWork } from '../../../../shared/infrastructure/database/database';
import { FixedClock, SequentialIdGenerator } from '../../../../shared/infrastructure/system';
import {
    FakeModuleFlags, FakeProjectStatuses, FakeRoles, FakeWorkspaceDirectory, RecordingAuditLog,
} from '../../../../shared/testing/platform-fakes';
import { asApprovalRequestId } from '../../domain/approvals-ids';
import { InMemoryApprovalPolicyRepository } from '../../infrastructure/adapters/in-memory-approval-policy.repository';
import { InMemoryApprovalRequestRepository } from '../../infrastructure/adapters/in-memory-approval-request.repository';
import { ListApprovalPoliciesUseCase, PutApprovalPolicyUseCase } from './approval-policies.use-cases';
import { CancelApprovalUseCase } from './cancel-approval.use-case';
import { DecideApprovalUseCase } from './decide-approval.use-case';
import { ListApprovalsUseCase } from './list-approvals.use-case';
import { RequestApprovalUseCase } from './request-approval.use-case';

class NamedUsers extends UserDirectory {
    findMany(ids: readonly UserId[]): Promise<Map<UserId, UserProfile>> {
        return Promise.resolve(new Map(ids.map(id => [id, { id, email: `${id}@x.io`, displayName: `user ${id.slice(-1)}` }])));
    }
}

const WS = asWorkspaceId('00000000-0000-4000-b000-000000000001');
const SOLO_WS = asWorkspaceId('00000000-0000-4000-b000-000000000002');
const OWNER = asUserId('00000000-0000-4000-a000-000000000001');
const ESTIMATOR = asUserId('00000000-0000-4000-a000-000000000002');
const VIEWER = asUserId('00000000-0000-4000-a000-000000000003');
const STRANGER = asUserId('00000000-0000-4000-a000-000000000004');
const SOLO = asUserId('00000000-0000-4000-a000-000000000005');
const PO = '00000000-0000-4000-9000-000000000001';

describe('approvals use cases', () => {
    let handlers: ApprovalHandlers;
    let audit: RecordingAuditLog;
    let flags: FakeModuleFlags;
    let requests: InMemoryApprovalRequestRepository;
    let request: RequestApprovalUseCase;
    let decide: DecideApprovalUseCase;
    let cancel: CancelApprovalUseCase;
    let list: ListApprovalsUseCase;
    let putPolicy: PutApprovalPolicyUseCase;
    let listPolicies: ListApprovalPoliciesUseCase;
    const decided: ApprovalDecidedEvent[] = [];
    let refuse: DomainError | undefined;

    beforeEach(() => {
        const roles = new FakeRoles();
        const dir = new FakeWorkspaceDirectory();
        const add = (ws: WorkspaceId, u: UserId, role: 'owner' | 'estimator' | 'viewer'): void => {
            roles.set(u, ws, role);
            dir.addMember(ws, u, role);
        };
        add(WS, OWNER, 'owner');
        add(WS, ESTIMATOR, 'estimator');
        add(WS, VIEWER, 'viewer');
        add(SOLO_WS, SOLO, 'owner');
        roles.set(STRANGER, asWorkspaceId('00000000-0000-4000-b000-000000000009'), 'owner');
        flags = new FakeModuleFlags();
        const access = new ModuleAccess(roles, new FakeProjectStatuses(), flags, dir);
        const policies = new InMemoryApprovalPolicyRepository();
        requests = new InMemoryApprovalRequestRepository();
        handlers = new ApprovalHandlers();
        audit = new RecordingAuditLog();
        const uow = new InMemoryUnitOfWork();
        const clock = new FixedClock();
        const users = new NamedUsers();
        request = new RequestApprovalUseCase(policies, requests, dir, audit, uow, clock, new SequentialIdGenerator());
        decide = new DecideApprovalUseCase(access, requests, policies, handlers, audit, users, uow, clock);
        cancel = new CancelApprovalUseCase(requests, audit, uow, clock);
        list = new ListApprovalsUseCase(access, requests, policies, users);
        putPolicy = new PutApprovalPolicyUseCase(access, policies, audit, uow, clock);
        listPolicies = new ListApprovalPoliciesUseCase(access, policies);
        decided.length = 0;
        refuse = undefined;
        handlers.register('purchase_order.issue', {
            onDecided: e => {
                if (refuse !== undefined) return Promise.resolve(err(refuse));
                decided.push(e);
                return Promise.resolve(okVoid());
            },
        });
    });

    const ask = (over: Partial<ApprovalRequestInput> = {}): ApprovalRequestInput => ({
        workspaceId: WS, subject: 'purchase_order.issue', subjectId: PO, projectId: null, amount: 60_000, title: 'PO-2026-0001',
        requestedBy: ESTIMATOR, requesterRole: 'estimator', ...over,
    });

    it('a solo owner: every subject is approved automatically and stored with its reason', async () => {
        const subjects: ApprovalSubject[] = ['quotation.issue', 'purchase_order.issue', 'payment_run.approve', 'pay_period.approve'];
        for (const [i, subject] of subjects.entries()) {
            const subjectId = `00000000-0000-4000-9000-00000000010${i}`;
            const r = await request.execute(ask({ workspaceId: SOLO_WS, subject, subjectId, requestedBy: SOLO, requesterRole: 'owner' }));
            expect(r).toMatchObject({ ok: true, value: { status: 'approved', auto: true } });
        }
        const stored = await requests.list(SOLO_WS, { limit: 10 });
        expect(stored.map(s => [s.subject, s.status, s.auto, s.autoReason])).toEqual([
            ['pay_period.approve', 'approved', true, 'solo'],
            ['payment_run.approve', 'approved', true, 'solo'],
            ['purchase_order.issue', 'approved', true, 'solo'],
            ['quotation.issue', 'approved', true, 'policy_off'],
        ]);
        expect(audit.entries.map(e => e.action)).toEqual(['auto_approved', 'auto_approved', 'auto_approved', 'auto_approved']);
    });

    it('owner + estimator: a 60,000 PO is pending; the owner approves and the handler runs', async () => {
        const ticket = await request.execute(ask());
        expect(ticket).toMatchObject({ ok: true, value: { status: 'pending', auto: false } });
        const id = asApprovalRequestId(ticket.ok ? ticket.value.requestId : '');

        const inbox = await list.execute({ userId: OWNER, workspaceId: WS, mine: true, limit: 50 });
        expect(inbox.ok && inbox.value.items.map(i => [i.id, i.canDecide, i.requestedByName])).toEqual([[id, true, 'user 2']]);
        const estimatorInbox = await list.execute({ userId: ESTIMATOR, workspaceId: WS, mine: true, limit: 50 });
        expect(estimatorInbox.ok && estimatorInbox.value.items).toEqual([]);

        const out = await decide.execute({ userId: OWNER, requestId: id, decision: 'approved', note: ' ok ' });
        expect(out).toMatchObject({ ok: true, value: { status: 'approved', decidedBy: OWNER, decisionNote: 'ok', canDecide: false } });
        expect(decided).toEqual([{ workspaceId: WS, projectId: null, requestId: id, subjectId: PO, decision: 'approved', decidedBy: OWNER, note: 'ok' }]);
        expect(audit.entries.at(-1)).toMatchObject({ entityType: 'approval_request', entityId: id, action: 'approved', actor: OWNER });
    });

    it('below the PO threshold the estimator needs no approval', async () => {
        expect(await request.execute(ask({ amount: 49_999.99 }))).toMatchObject({ ok: true, value: { status: 'approved', auto: true } });
    });

    it('a handler error rolls the decision back (still pending)', async () => {
        const ticket = await request.execute(ask());
        const id = asApprovalRequestId(ticket.ok ? ticket.value.requestId : '');
        refuse = DomainError.conflict('no budget', { reason: 'over_budget' });
        const out = await decide.execute({ userId: OWNER, requestId: id, decision: 'approved', note: '' });
        expect(out).toEqual({ ok: false, error: refuse });
        expect((await requests.findById(id))?.status).toBe('pending');
        expect(audit.entries.map(e => e.action)).toEqual(['requested']);
    });

    it('asking again while pending → conflict; after cancel it can be asked again', async () => {
        await request.execute(ask());
        const again = await request.execute(ask());
        expect(again).toMatchObject({ ok: false, error: { code: 'conflict', details: { reason: 'approval_pending' } } });
        await cancel.execute(WS, 'purchase_order.issue', PO, ESTIMATOR);
        expect((await requests.latestOf(WS, 'purchase_order.issue', PO))?.status).toBe('cancelled');
        expect(await request.execute(ask())).toMatchObject({ ok: true, value: { status: 'pending' } });
    });

    it('non-approver → forbidden; outsider → not_found; decided → invalid_transition; module off → module_disabled', async () => {
        const ticket = await request.execute(ask());
        const id = asApprovalRequestId(ticket.ok ? ticket.value.requestId : '');
        const code = async (userId: UserId): Promise<string> => {
            const r = await decide.execute({ userId, requestId: id, decision: 'rejected', note: '' });
            return r.ok ? 'ok' : r.error.code;
        };
        expect(await code(VIEWER)).toBe('forbidden');
        expect(await code(ESTIMATOR)).toBe('forbidden');
        expect(await code(STRANGER)).toBe('not_found');
        flags.set(WS, 'project-hub', false);
        expect(await code(OWNER)).toBe('module_disabled');
        flags.set(WS, 'project-hub', true);
        expect(await code(OWNER)).toBe('ok');
        const again = await decide.execute({ userId: OWNER, requestId: id, decision: 'approved', note: '' });
        expect(again).toMatchObject({ ok: false, error: { code: 'conflict', details: { reason: 'invalid_transition' } } });
        expect(decided.map(d => d.decision)).toEqual(['rejected']);
    });

    it('policies: defaults, owner always added, audit of the change', async () => {
        const before = await listPolicies.execute(OWNER, WS);
        expect(before.ok && before.value.find(p => p.subject === 'purchase_order.issue')).toMatchObject({ enabled: true, minAmount: 50_000, isDefault: true });
        expect((await putPolicy.execute({
            userId: ESTIMATOR, workspaceId: WS, subject: 'quotation.issue', policy: { enabled: true, minAmount: null, approverRoles: [], selfApprove: false },
        })).ok).toBe(false);
        const saved = await putPolicy.execute({
            userId: OWNER, workspaceId: WS, subject: 'quotation.issue', policy: { enabled: true, minAmount: null, approverRoles: ['admin'], selfApprove: false },
        });
        expect(saved).toMatchObject({ ok: true, value: { enabled: true, approverRoles: ['owner', 'admin'], isDefault: false } });
        expect(audit.entries.at(-1)).toMatchObject({ entityType: 'approval_policy', entityId: 'quotation.issue', data: { enabled: [false, true], selfApprove: [true, false] } });
        // now an estimator's quotation waits for the owner
        expect(await request.execute(ask({ subject: 'quotation.issue', amount: null }))).toMatchObject({ ok: true, value: { status: 'pending' } });
    });
});
