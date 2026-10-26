// ─── E2E: module 1 "จ้างช่วง" across both sides — buyer package → vendor OTP + bid → leveling → award → contract →
// claim → inspect → approve → pay; module switch; cross-tenant isolation. In-memory persistence, FixedClock. ───
import {
    type CreatePackageRequest, awardResponseSchema, bidDtoSchema, buyerPackageDtoSchema, claimDtoSchema,
    createInvitationsResponseSchema, fileDtoSchema, guestPackageDtoSchema, levelingDtoSchema, phoneAuthResponseSchema,
    procurementOverviewDtoSchema, subcontractDtoSchema, vendorInboxDtoSchema, vendorListEntryDtoSchema,
    workspaceModuleDtoSchema,
} from '@contrack/contract';
import { computeProject, createProject } from '@contrack/domain/project';
import { subcontractableRows } from '@contrack/domain/subcontracting';
import { SmsSender } from '../../src/modules/platform/application/ports/sms-sender.port';
import { RecordingSmsSender } from '../../src/modules/platform/testing/recording-sms-sender';
import {
    type Session, type TestApp, bearer, createCompany, expectError, expectStatus, register, startApp,
} from '../support/e2e';

const SAMPLE_BOQ = computeProject(createProject('sample')).boq;
/** E2E_DATABASE_URL=<migrated empty db> runs the same flow on PostgreSQL (exercises every Drizzle adapter). */
const DB = process.env.E2E_DATABASE_URL;
const PERSIST: Record<string, string> = DB === undefined ? {} : { PERSISTENCE: 'postgres', DATABASE_URL: DB };
const MASONRY_KEYS = subcontractableRows(SAMPLE_BOQ).filter(r => r.trade === 'masonry' && r.row.qty > 0).map(r => r.row.key);

interface VendorSession { accessToken: string; userId: string; vendorWorkspaceId: string }

/** The 6-digit code of the last SMS sent to `phone` (the test app sends SMS to a recording sender). */
function lastCode(t: TestApp, phone: string): string {
    const sms = t.app.get(SmsSender, { strict: false });
    if (!(sms instanceof RecordingSmsSender)) throw new Error('the test app should record SMS');
    const msg = [...sms.sent].reverse().find(m => m.phone === phone);
    const code = /\d{6}/.exec(msg?.text ?? '')?.[0];
    if (code === undefined) throw new Error(`no OTP sent to ${phone}`);
    return code;
}

async function otpSignIn(t: TestApp, phone: string, teamName: string, invitationToken?: string): Promise<VendorSession> {
    expectStatus(await t.http().post('/auth/otp/request').send({ phone }), 204);
    const code = lastCode(t, phone.replace(/^0/, '+66').replace(/-/g, ''));
    const res = await t.http().post('/auth/otp/verify').send({
        phone, code, displayName: `ช่าง ${teamName}`, teamName, ...(invitationToken === undefined ? {} : { invitationToken }),
    });
    expectStatus(res, 200);
    const body = phoneAuthResponseSchema.parse(res.body);
    if (body.vendorWorkspaceId === null) throw new Error('no vendor workspace after OTP sign-up');
    return { accessToken: body.accessToken, userId: body.user.id, vendorWorkspaceId: body.vendorWorkspaceId };
}

const tokenOf = (url: string): string => url.slice(url.lastIndexOf('/') + 1);

describe('subcontracting (e2e)', () => {
    let t: TestApp;
    let owner: Session;
    let outsider: Session;
    let workspaceId: string;
    let projectId: string;

    beforeAll(async () => {
        t = await startApp(PERSIST);
        owner = await register(t, 'Owner');
        outsider = await register(t, 'Outsider');
        workspaceId = (await createCompany(t, owner, 'รับเหมาดี จำกัด')).id;
        const p = await t.http().post(`/workspaces/${workspaceId}/projects`).set(bearer(owner.accessToken))
            .send({ name: 'บ้านคุณสมชาย', start: 'sample' });
        expectStatus(p, 201);
        projectId = (p.body as { project: { id: string } }).project.id;
        const on = await t.http().put(`/workspaces/${workspaceId}/modules/subcontracting`).set(bearer(owner.accessToken)).send({ enabled: true });
        expectStatus(on, 200);
        expect(workspaceModuleDtoSchema.parse(on.body).enabled).toBe(true);
    });

    afterAll(async () => {
        await t.close();
    });

    const packageBody = (): CreatePackageRequest => ({
        title: 'ก่ออิฐ-ฉาบปูน ทั้งหลัง',
        trade: 'masonry',
        lineKeys: MASONRY_KEYS,
        customLines: [],
        supplyMode: 'labour_only',
        materialByLine: {},
        pricingMode: 'unit',
        sourcingMode: 'rfq',
        terms: {
            retentionPct: 0.05, warrantyMonths: 12, penalty: { kind: 'per_day', amount: 500 },
            provisions: { water: 'buyer', power: 'buyer', lodging: 'vendor', scaffolding: 'vendor' },
            safetyNote: '', questions: ['เคยทำงานฉาบเรียบขัดมันไหม'],
        },
        schedule: { start: '2026-03-10', finish: '2026-04-10', days: 30 },
        installments: [
            { no: 1, pct: 0.3, condition: 'ก่ออิฐเสร็จ' },
            { no: 2, pct: 0.4, condition: 'ฉาบเสร็จ' },
            { no: 3, pct: 0.3, condition: 'ส่งมอบงาน' },
        ],
        location: { district: 'บางกรวย', province: 'นนทบุรี', address: '99/1 ถนนบางกรวย-ไทรน้อย' },
        hideOwnerIdentity: true,
        bidDeadline: '2026-03-06T10:00:00.000Z',
        priceValidUntil: '2026-04-01',
        description: 'บ้านชั้นเดียว ตามแบบที่แนบ',
    });

    it('runs the whole flow from package to a paid installment', async () => {
        // ── buyer: vendor list + package + invitation ──
        const entry = await t.http().post(`/workspaces/${workspaceId}/vendor-list`).set(bearer(owner.accessToken))
            .send({ displayName: 'ทีมช่างสมศักดิ์', phone: '081-234-5678', trades: ['masonry'], province: 'นนทบุรี' });
        expectStatus(entry, 201);
        const entryId = vendorListEntryDtoSchema.parse(entry.body).id;

        const created = await t.http().post(`/projects/${projectId}/subcontracting/packages`).set(bearer(owner.accessToken)).send(packageBody());
        expectStatus(created, 201);
        const pkg = buyerPackageDtoSchema.parse(created.body);
        expect(pkg.status).toBe('draft');
        expect(pkg.lines.length).toBe(MASONRY_KEYS.length);
        expect(pkg.estimateTotal).toBeGreaterThan(0);

        const sent = await t.http().post(`/subcontracting/packages/${pkg.id}/invitations`).set(bearer(owner.accessToken))
            .send({ entries: [{ vendorListEntryId: entryId, channel: 'link' }] });
        expectStatus(sent, 201);
        const { links } = createInvitationsResponseSchema.parse(sent.body);
        const token = tokenOf(links[0]?.url ?? '');

        // ── guest view: quantities, no estimate, owner hidden ──
        const guest = await t.http().get(`/s/${token}`);
        expectStatus(guest, 200);
        const view = guestPackageDtoSchema.parse(guest.body);
        expect(view.lines.length).toBe(pkg.lines.length);
        expect(view.projectName).toBe('');
        expect(view.location.address).toBe('');
        expect(JSON.stringify(guest.body)).not.toMatch(/est(Total|LabUnit|MatUnit)|estimateTotal/);

        // ── vendor: OTP sign-up through the link, inbox, bid ──
        const vendor = await otpSignIn(t, '081-234-5678', 'ทีมช่างสมศักดิ์', token);
        const inbox = await t.http().get('/vendor/inbox').query({ workspaceId: vendor.vendorWorkspaceId }).set(bearer(vendor.accessToken));
        expectStatus(inbox, 200);
        const inv = vendorInboxDtoSchema.parse(inbox.body).invitations.find(i => i.packageId === pkg.id);
        expect(inv).toBeDefined();
        const invitationId = inv?.invitationId ?? '';

        const bid = await t.http().post(`/vendor/invitations/${invitationId}/bid`).set(bearer(vendor.accessToken)).send({
            mode: 'unit',
            lines: view.lines.map(l => ({ idx: l.idx, unitPrice: 100, matUnitPrice: null, excluded: false, reason: '' })),
            lumpTotal: null, adjustment: 0, adjustmentNote: '', inclusions: '', days: 28, earliestStart: '2026-03-10',
            crewSkilled: 4, crewLabourers: 2, validUntil: '2026-04-01', installmentsProposal: null,
            answers: ['เคย'], note: '', photoFileIds: [],
        });
        expectStatus(bid, 201);
        const bidDto = bidDtoSchema.parse(bid.body);
        const expected = view.lines.reduce((s, l) => s + Math.round(100 * l.qtyPriced * 100) / 100, 0);
        expect(bidDto.total).toBeCloseTo(expected, 2);

        // ── buyer: leveling + award ──
        const lev = levelingDtoSchema.parse((await t.http().get(`/subcontracting/packages/${pkg.id}/leveling`).set(bearer(owner.accessToken))).body);
        expect(lev.bidders).toHaveLength(1);
        const award = await t.http().post(`/subcontracting/packages/${pkg.id}/award`).set(bearer(owner.accessToken))
            .send({ allocations: view.lines.map(l => ({ idx: l.idx, bidId: bidDto.id })), installmentsFrom: {}, note: '' });
        expectStatus(award, 200);
        const subcontractId = awardResponseSchema.parse(award.body).subcontractIds[0] ?? '';

        // ── vendor: accept the contract ──
        const sc = subcontractDtoSchema.parse((await t.http().get(`/subcontracting/subcontracts/${subcontractId}`).set(bearer(vendor.accessToken))).body);
        expect(sc.status).toBe('pending_acceptance');
        expect(sc.viewerSide).toBe('vendor');
        expect(sc.total).toBeCloseTo(bidDto.total, 2);
        const accepted = await t.http().post(`/subcontracting/subcontracts/${subcontractId}/accept`).set(bearer(vendor.accessToken))
            .send({ documentVersion: sc.documentVersion });
        expectStatus(accepted, 200);
        expect(subcontractDtoSchema.parse(accepted.body).status).toBe('active');

        // ── claim installment 1 with a photo → inspect → approve → pay ──
        const upload = await t.http().post('/files').set(bearer(vendor.accessToken))
            .field('purpose', 'claim_photo').attach('file', Buffer.from([0xff, 0xd8, 0xff, 0xd9]), { filename: 'wall.jpg', contentType: 'image/jpeg' });
        expectStatus(upload, 201);
        const photo = fileDtoSchema.parse(upload.body);
        const claimRes = await t.http().post(`/subcontracting/subcontracts/${subcontractId}/claims`).set(bearer(vendor.accessToken))
            .send({ installmentNo: 1, note: 'ก่ออิฐเสร็จแล้ว', photoFileIds: [photo.id] });
        expectStatus(claimRes, 201);
        const claimId = claimDtoSchema.parse(claimRes.body).id;

        expectStatus(await t.http().post(`/subcontracting/claims/${claimId}/inspect`).set(bearer(owner.accessToken))
            .send({ result: 'pass', checklist: [{ item: 'ผนังได้ดิ่งได้แนว', ok: true }], fixes: [], note: '' }), 200);
        const approved = await t.http().post(`/subcontracting/claims/${claimId}/approve`).set(bearer(owner.accessToken)).send({ adjustments: [] });
        expectStatus(approved, 200);
        const amounts = claimDtoSchema.parse(approved.body).amounts;
        const gross = Math.round(sc.total * 0.3 * 100) / 100;
        expect(amounts.gross).toBeCloseTo(gross, 2);
        expect(amounts.retention).toBeCloseTo(Math.round(gross * 0.05 * 100) / 100, 2);
        expect(amounts.net).toBeCloseTo(amounts.gross - amounts.retention - amounts.wht + amounts.vat, 2);

        const paid = await t.http().post(`/subcontracting/claims/${claimId}/pay`).set(bearer(owner.accessToken))
            .send({ paidAt: '2026-03-20', amount: amounts.net, channel: 'โอน', ref: '' });
        expectStatus(paid, 200);
        expect(claimDtoSchema.parse(paid.body).status).toBe('paid');

        const after = subcontractDtoSchema.parse((await t.http().get(`/subcontracting/subcontracts/${subcontractId}`).set(bearer(owner.accessToken))).body);
        expect(after.retention.balance).toBeCloseTo(amounts.retention, 2);
        expect(after.paidTotal).toBeCloseTo(amounts.net, 2);

        const overview = procurementOverviewDtoSchema.parse(
            (await t.http().get(`/projects/${projectId}/subcontracting/overview`).set(bearer(owner.accessToken))).body);
        expect(overview.trades.find(r => r.trade === 'masonry')?.status).toBe('contracted');

        // ── isolation: another crew and an outsider see nothing ──
        const other = await otpSignIn(t, '089-999-0000', 'ทีมอื่น');
        expectError(await t.http().get(`/vendor/invitations/${invitationId}`).set(bearer(other.accessToken)), 404, 'not_found');
        expectError(await t.http().get(`/subcontracting/subcontracts/${subcontractId}`).set(bearer(other.accessToken)), 404, 'not_found');
        expectError(await t.http().get(`/subcontracting/packages/${pkg.id}`).set(bearer(outsider.accessToken)), 404, 'not_found');

        // ── module switch: off needs confirmation while a contract runs; vendor keeps read access ──
        expectError(await t.http().put(`/workspaces/${workspaceId}/modules/subcontracting`).set(bearer(owner.accessToken))
            .send({ enabled: false }), 409, 'conflict');
        expectStatus(await t.http().put(`/workspaces/${workspaceId}/modules/subcontracting`).set(bearer(owner.accessToken))
            .send({ enabled: false, confirm: true }), 200);
        expectError(await t.http().get(`/subcontracting/packages/${pkg.id}`).set(bearer(owner.accessToken)), 404, 'module_disabled');
        expectStatus(await t.http().get(`/subcontracting/subcontracts/${subcontractId}`).set(bearer(vendor.accessToken)), 200);
        expectError(await t.http().post(`/subcontracting/subcontracts/${subcontractId}/claims`).set(bearer(vendor.accessToken))
            .send({ installmentNo: 2, note: '', photoFileIds: [] }), 404, 'module_disabled');
        // The BOQ itself is untouched by the switch.
        expectStatus(await t.http().get(`/projects/${projectId}`).set(bearer(owner.accessToken)), 200);
        expectStatus(await t.http().put(`/workspaces/${workspaceId}/modules/subcontracting`).set(bearer(owner.accessToken))
            .send({ enabled: true }), 200);
        expectStatus(await t.http().get(`/subcontracting/packages/${pkg.id}`).set(bearer(owner.accessToken)), 200);
    });

    it('refuses an unknown BOQ row and the not-yet-available open board', async () => {
        expectError(await t.http().post(`/projects/${projectId}/subcontracting/packages`).set(bearer(owner.accessToken))
            .send({ ...packageBody(), lineKeys: ['no-such-row'] }), 422, 'unprocessable');
        expectError(await t.http().post(`/projects/${projectId}/subcontracting/packages`).set(bearer(owner.accessToken))
            .send({ ...packageBody(), sourcingMode: 'open' }), 422, 'unprocessable');
    });

    it('is invisible when the platform does not offer the module', async () => {
        const plain = await startApp({ ...PERSIST, MODULES_ENABLED: '' });
        try {
            const o = await register(plain, 'PlainOwner');
            const ws = (await createCompany(plain, o, 'Plain')).id;
            expect((await plain.http().get('/platform/modules')).body).toEqual({ modules: [] });
            expectError(await plain.http().put(`/workspaces/${ws}/modules/subcontracting`).set(bearer(o.accessToken))
                .send({ enabled: true }), 422, 'unprocessable');
            expectError(await plain.http().get(`/workspaces/${ws}/vendor-list`).set(bearer(o.accessToken)), 404, 'module_disabled');
        } finally {
            await plain.close();
        }
    });
});
