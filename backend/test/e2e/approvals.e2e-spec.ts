// ─── E2E: approval workflow + audit log over HTTP (in-memory persistence, the whole app wired) ───
import { approvalListDtoSchema, approvalPoliciesDtoSchema, approvalRequestDtoSchema, auditListDtoSchema } from '@contrack/contract';
import { type ApprovalDecidedEvent, ApprovalHandlers, Approvals } from '../../src/shared/application/ports';
import { asUserId, asWorkspaceId, okVoid } from '../../src/shared/domain';
import { type Session, type TestApp, addMember, bearer, createCompany, expectError, expectStatus, register, startApp } from '../support/e2e';

const PO = '00000000-0000-4000-8000-0000000000a1';

describe('approvals (e2e)', () => {
    let t: TestApp;
    let owner: Session;
    let estimator: Session;
    let viewer: Session;
    let outsider: Session;
    let ws: string;
    const decided: ApprovalDecidedEvent[] = [];

    beforeAll(async () => {
        t = await startApp();
        // A subject no module handles yet (procurement registers `purchase_order.issue` itself since WP-39).
        t.app.get(ApprovalHandlers).register('payment_run.approve', {
            onDecided: e => {
                decided.push(e);
                return Promise.resolve(okVoid());
            },
        });
        owner = await register(t, 'Owner');
        estimator = await register(t, 'Estimator');
        viewer = await register(t, 'Viewer');
        outsider = await register(t, 'Outsider');
        ws = (await createCompany(t, owner, 'Acme')).id;
        await addMember(t, owner, ws, estimator, 'estimator');
        await addMember(t, owner, ws, viewer, 'viewer');
    });

    afterAll(async () => {
        await t.close();
    });

    it('is module_disabled until project-hub is switched on', async () => {
        expectError(await t.http().get(`/workspaces/${ws}/approvals`).set(bearer(owner.accessToken)), 404, 'module_disabled');
        expectStatus(await t.http().put(`/workspaces/${ws}/modules/project-hub`).set(bearer(owner.accessToken)).send({ enabled: true }), 200);
        expectStatus(await t.http().get(`/workspaces/${ws}/approvals`).set(bearer(owner.accessToken)), 200);
    });

    it('request → inbox → decide → audit', async () => {
        const approvals = t.app.get(Approvals);
        const ticket = await approvals.request({
            workspaceId: asWorkspaceId(ws), subject: 'payment_run.approve', subjectId: PO, projectId: null, amount: 60_000,
            title: 'PO-0001', requestedBy: asUserId(estimator.userId), requesterRole: 'estimator',
        });
        expect(ticket).toMatchObject({ ok: true, value: { status: 'pending', auto: false } });
        const requestId = ticket.ok ? ticket.value.requestId : '';

        const inbox = approvalListDtoSchema.parse((await t.http().get(`/workspaces/${ws}/approvals?mine=true`).set(bearer(owner.accessToken))).body);
        expect(inbox.items.map(i => [i.id, i.canDecide, i.amount])).toEqual([[requestId, true, 60_000]]);
        const viewerList = approvalListDtoSchema.parse((await t.http().get(`/workspaces/${ws}/approvals`).set(bearer(viewer.accessToken))).body);
        expect(viewerList.items).toEqual([]);

        expectError(await t.http().post(`/approvals/${requestId}/decide`).set(bearer(viewer.accessToken)).send({ decision: 'approved' }), 403, 'forbidden');
        expectError(await t.http().post(`/approvals/${requestId}/decide`).set(bearer(outsider.accessToken)).send({ decision: 'approved' }), 404, 'not_found');
        const res = await t.http().post(`/approvals/${requestId}/decide`).set(bearer(owner.accessToken)).send({ decision: 'approved', note: 'go' });
        expectStatus(res, 200);
        expect(approvalRequestDtoSchema.parse(res.body)).toMatchObject({ status: 'approved', decisionNote: 'go' });
        expect(decided.map(d => d.subjectId)).toEqual([PO]);
        const again = expectError(await t.http().post(`/approvals/${requestId}/decide`).set(bearer(owner.accessToken)).send({ decision: 'rejected' }), 409, 'conflict');
        expect(again.details).toMatchObject({ reason: 'invalid_transition' });

        const audit = auditListDtoSchema.parse((await t.http().get(`/workspaces/${ws}/audit?entityType=approval_request&entityId=${requestId}`)
            .set(bearer(owner.accessToken))).body);
        expect(audit.items.map(e => e.action)).toEqual(['approved', 'requested']);
        expectError(await t.http().get(`/workspaces/${ws}/audit`).set(bearer(estimator.accessToken)), 403, 'forbidden');
        // cursors beyond what PostgreSQL can compare are refused, not a 500
        expectError(await t.http().get(`/workspaces/${ws}/audit?before=9999999999999999999`).set(bearer(owner.accessToken)), 400, 'validation_failed');
        expectError(await t.http().get(`/workspaces/${ws}/approvals?before=${encodeURIComponent(`+275760-09-13T00:00:00.000Z_${requestId}`)}`)
            .set(bearer(owner.accessToken)), 400, 'validation_failed');
    });

    it('policies: read by members, written with company.manage', async () => {
        const list = approvalPoliciesDtoSchema.parse((await t.http().get(`/workspaces/${ws}/approval-policies`).set(bearer(viewer.accessToken))).body);
        expect(list.find(p => p.subject === 'purchase_order.issue')).toMatchObject({ minAmount: 50_000, module: 'procurement', isDefault: true });
        const body = { enabled: true, minAmount: null, approverRoles: ['admin'], selfApprove: false };
        expectError(await t.http().put(`/workspaces/${ws}/approval-policies/quotation.issue`).set(bearer(estimator.accessToken)).send(body), 403, 'forbidden');
        expectError(await t.http().put(`/workspaces/${ws}/approval-policies/nope`).set(bearer(owner.accessToken)).send(body), 404, 'not_found');
        const saved = await t.http().put(`/workspaces/${ws}/approval-policies/quotation.issue`).set(bearer(owner.accessToken)).send(body);
        expectStatus(saved, 200);
        expect(saved.body).toMatchObject({ approverRoles: ['owner', 'admin'], isDefault: false });
    });
});
