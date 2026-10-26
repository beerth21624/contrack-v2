import type { Role } from '@contrack/contract';
import { asSubcontractId } from '../../../shared/ids';
import {
    BUYER, BUYER_WS, OUTSIDER, PROJECT, VENDOR, VENDOR_WS, activeContract, codeOf, contractsKit, must, payInstallment,
} from '../../testing/contracts-test-kit';

const MISSING = asSubcontractId('00000000-0000-4000-8fff-000000000001');

describe('GetSubcontractUseCase', () => {
    it('both sides read the same contract, each with its viewerSide', async () => {
        const kit = contractsKit();
        const id = await kit.award();
        const buyer = must(await kit.get.execute({ userId: BUYER.viewer, subcontractId: id }));
        const vendor = must(await kit.get.execute({ userId: VENDOR.viewer, subcontractId: id }));
        expect(buyer.viewerSide).toBe('buyer');
        expect(vendor.viewerSide).toBe('vendor');
        expect(vendor).toMatchObject({
            contractNo: 'SC-2026-0001', status: 'pending_acceptance', total: 500_000, pendingAction: 'vendor_accept', nextInstallment: 1,
            documentPdf: null, signedScan: null, retention: { balance: 0, schedule: [] }, myRating: { submitted: false },
        });
        expect(vendor.installments.map(i => [i.no, i.amount, i.state])).toEqual([[1, 200_000, 'not_started'], [2, 300_000, 'not_started']]);
    });

    it('a non-member (or an unknown id) gets not_found', async () => {
        const kit = contractsKit();
        const id = await kit.award();
        expect(codeOf(await kit.get.execute({ userId: OUTSIDER, subcontractId: id }))).toBe('not_found');
        expect(codeOf(await kit.get.execute({ userId: BUYER.owner, subcontractId: MISSING }))).toBe('not_found');
    });

    it('buyer module off: buyer gets module_disabled, the vendor still reads but cannot act', async () => {
        const kit = contractsKit();
        const id = await kit.award();
        kit.flags.set(BUYER_WS, 'subcontracting', false);
        expect(codeOf(await kit.get.execute({ userId: BUYER.owner, subcontractId: id }))).toBe('module_disabled');
        expect(codeOf(await kit.get.execute({ userId: VENDOR.owner, subcontractId: id }))).toBe('ok');
        expect(codeOf(await kit.accept.execute({ userId: VENDOR.owner, subcontractId: id, documentVersion: 1, ip: null }))).toBe('module_disabled');
    });

    it('platform off: the vendor side gets module_disabled too', async () => {
        const kit = contractsKit();
        const id = await kit.award();
        kit.flags.platform.clear();
        expect(codeOf(await kit.get.execute({ userId: VENDOR.owner, subcontractId: id }))).toBe('module_disabled');
    });
});

describe('Contract document', () => {
    it('GET returns the current sanitized version; editable only for a buyer with sc.award before acceptance', async () => {
        const kit = contractsKit();
        const id = await kit.award();
        const owner = must(await kit.getDocument.execute({ userId: BUYER.owner, subcontractId: id }));
        expect(owner.version).toBe(1);
        expect(owner.editable).toBe(true);
        expect(owner.html).not.toMatch(/<script|on\w+=/i);
        expect(must(await kit.getDocument.execute({ userId: BUYER.estimator, subcontractId: id })).editable).toBe(false);
        expect(must(await kit.getDocument.execute({ userId: VENDOR.owner, subcontractId: id })).editable).toBe(false);
    });

    it('PUT stores a sanitized new version, resolves change requests and asks the crew again', async () => {
        const kit = contractsKit();
        const id = await kit.award();
        must(await kit.requestChange.execute({ userId: VENDOR.owner, subcontractId: id, text: 'ขอแก้ค่าปรับ' }));
        const doc = must(await kit.updateDocument.execute({ userId: BUYER.admin, subcontractId: id, html: '<p onclick="x()">ใหม่<script>alert(1)</script></p>' }));
        expect(doc).toEqual({ version: 2, html: '<p>ใหม่</p>', editable: true });
        const sc = must(await kit.get.execute({ userId: VENDOR.owner, subcontractId: id }));
        expect(sc.documentVersion).toBe(2);
        expect(sc.changeRequests).toEqual([{ text: 'ขอแก้ค่าปรับ', at: kit.clock.now().toISOString(), resolved: true }]);
        expect(kit.notifier.templates()).toEqual(['sc.change_requested', 'sc.contract_to_accept']);
        expect(kit.notifier.sent[1]).toMatchObject({ toWorkspaceIds: [VENDOR_WS], payload: { title: 'งานก่ออิฐฉาบปูน', total: '500,000 บาท', href: `/vendor/contracts/${id}` } });
        expect(codeOf(await kit.accept.execute({ userId: VENDOR.owner, subcontractId: id, documentVersion: 1, ip: null }))).toBe('conflict');
    });

    it('PUT: estimator forbidden unless settings allow, vendor forbidden, empty text refused, after acceptance conflict', async () => {
        const kit = contractsKit();
        const id = await kit.award();
        expect(codeOf(await kit.updateDocument.execute({ userId: BUYER.estimator, subcontractId: id, html: '<p>x</p>' }))).toBe('forbidden');
        expect(codeOf(await kit.updateDocument.execute({ userId: VENDOR.owner, subcontractId: id, html: '<p>x</p>' }))).toBe('forbidden');
        expect(codeOf(await kit.updateDocument.execute({ userId: BUYER.owner, subcontractId: id, html: '<script>x</script>' }))).toBe('unprocessable');
        await kit.settingsRepo.put(BUYER_WS, { ...(await kit.settings.get(BUYER_WS)), estimatorCanAward: true }, BUYER.owner, kit.clock.now());
        expect(codeOf(await kit.updateDocument.execute({ userId: BUYER.estimator, subcontractId: id, html: '<p>x</p>' }))).toBe('ok');
        must(await kit.accept.execute({ userId: VENDOR.owner, subcontractId: id, documentVersion: 2, ip: null }));
        expect(codeOf(await kit.updateDocument.execute({ userId: BUYER.owner, subcontractId: id, html: '<p>y</p>' }))).toBe('conflict');
    });
});

describe('AcceptSubcontractUseCase', () => {
    it('the crew accepts the current version → active, evidence kept, buyer notified', async () => {
        const kit = contractsKit();
        const id = await kit.award();
        const dto = must(await kit.accept.execute({ userId: VENDOR.admin, subcontractId: id, documentVersion: 1, ip: '203.0.113.5' }));
        expect(dto.status).toBe('active');
        expect(dto.acceptedAt).toBe(kit.clock.now().toISOString());
        const sc = await kit.subcontracts.findById(id);
        expect(sc?.state).toMatchObject({ acceptedBy: VENDOR.admin, acceptedIp: '203.0.113.5' });
        expect(kit.notifier.sent).toEqual([{
            template: 'sc.contract_accepted', toWorkspaceIds: [BUYER_WS],
            payload: { vendorName: 'ทีมช่างสมชาย', title: 'งานก่ออิฐฉาบปูน', href: `/subcontracting/contracts/${id}` },
        }]);
        expect(kit.activity.rows.at(-1)).toMatchObject({ action: 'accepted', data: { from: 'pending_acceptance', to: 'active' } });
        expect(codeOf(await kit.accept.execute({ userId: VENDOR.admin, subcontractId: id, documentVersion: 1, ip: null }))).toBe('conflict');
    });

    it.each<[Role, string]>([['owner', 'ok'], ['admin', 'ok'], ['estimator', 'forbidden'], ['viewer', 'forbidden']])(
        'vendor %s → %s', async (role, code) => {
            const kit = contractsKit();
            const id = await kit.award();
            expect(codeOf(await kit.accept.execute({ userId: VENDOR[role], subcontractId: id, documentVersion: 1, ip: null }))).toBe(code);
        },
    );

    it('the buyer cannot accept for the crew', async () => {
        const kit = contractsKit();
        const id = await kit.award();
        expect(codeOf(await kit.accept.execute({ userId: BUYER.owner, subcontractId: id, documentVersion: 1, ip: null }))).toBe('forbidden');
        expect(codeOf(await kit.requestChange.execute({ userId: BUYER.owner, subcontractId: id, text: 'x' }))).toBe('forbidden');
    });

    it('request-change only while pending', async () => {
        const kit = contractsKit();
        const id = await activeContract(kit);
        expect(codeOf(await kit.requestChange.execute({ userId: VENDOR.owner, subcontractId: id, text: 'x' }))).toBe('conflict');
    });
});

describe('Cancel / terminate / complete / close', () => {
    it('cancel (either side, pending only) reopens the package when nothing else is live', async () => {
        const kit = contractsKit();
        const id = await kit.award();
        const dto = must(await kit.cancel.execute({ userId: VENDOR.owner, subcontractId: id, reason: 'คิวเต็ม' }));
        expect(dto).toMatchObject({ status: 'cancelled', endReason: 'คิวเต็ม' });
        expect(kit.packages.reopened).toHaveLength(1);
        // the bids' decisions go back to submitted in the same transaction, so the package can be awarded again
        expect(kit.bids.resets).toEqual(kit.packages.reopened);
        expect(codeOf(await kit.cancel.execute({ userId: BUYER.owner, subcontractId: id, reason: 'x' }))).toBe('conflict');
        expect(kit.bids.resets).toHaveLength(1);
    });

    it('cancel keeps the package awarded while another subcontract of it is live; estimator / viewer forbidden', async () => {
        const kit = contractsKit();
        const a = await kit.award();
        const packageId = (await kit.subcontracts.findById(a))!.packageId;
        const b = await kit.award({ packageId });
        expect(codeOf(await kit.cancel.execute({ userId: BUYER.estimator, subcontractId: b, reason: 'x' }))).toBe('forbidden');
        expect(codeOf(await kit.cancel.execute({ userId: BUYER.viewer, subcontractId: b, reason: 'x' }))).toBe('forbidden');
        must(await kit.cancel.execute({ userId: BUYER.owner, subcontractId: b, reason: 'เปลี่ยนใจ' }));
        expect(kit.packages.reopened).toEqual([]);
        expect(kit.bids.resets).toEqual([]);
        must(await kit.cancel.execute({ userId: BUYER.owner, subcontractId: a, reason: 'เปลี่ยนใจ' }));
        expect(kit.packages.reopened).toEqual([packageId]);
        expect(kit.bids.resets).toEqual([packageId]);
    });

    it('terminate: buyer sc.award, active only; ends the package', async () => {
        const kit = contractsKit();
        const id = await kit.award();
        expect(codeOf(await kit.terminate.execute({ userId: BUYER.owner, subcontractId: id, reason: 'x' }))).toBe('conflict');
        must(await kit.accept.execute({ userId: VENDOR.owner, subcontractId: id, documentVersion: 1, ip: null }));
        expect(codeOf(await kit.terminate.execute({ userId: VENDOR.owner, subcontractId: id, reason: 'x' }))).toBe('forbidden');
        expect(codeOf(await kit.terminate.execute({ userId: BUYER.estimator, subcontractId: id, reason: 'x' }))).toBe('forbidden');
        expect(must(await kit.terminate.execute({ userId: BUYER.admin, subcontractId: id, reason: 'ทิ้งงาน' })).status).toBe('terminated');
        expect(kit.packages.closed).toHaveLength(1);
    });

    it('complete needs every installment paid; close needs the retention balance at 0', async () => {
        const kit = contractsKit();
        const id = await activeContract(kit);
        expect(codeOf(await kit.complete.execute({ userId: BUYER.owner, subcontractId: id }))).toBe('conflict');
        await payInstallment(kit, id, 1);
        await payInstallment(kit, id, 2);
        expect(codeOf(await kit.complete.execute({ userId: BUYER.estimator, subcontractId: id }))).toBe('forbidden');
        const done = must(await kit.complete.execute({ userId: BUYER.owner, subcontractId: id }));
        expect(done.status).toBe('completed');
        expect(done.retention.balance).toBe(25_000);
        expect(done.retention.schedule.map(s => [s.amount, s.dueAt])).toEqual([[12_500, '2026-10-26'], [12_500, '2027-10-26']]);
        expect(codeOf(await kit.close.execute({ userId: BUYER.owner, subcontractId: id }))).toBe('conflict');
        must(await kit.moveRetention.execute({ userId: BUYER.owner, subcontractId: id, kind: 'released', amount: 25_000, note: '' }));
        expect(codeOf(await kit.close.execute({ userId: BUYER.estimator, subcontractId: id }))).toBe('forbidden');
        expect(must(await kit.close.execute({ userId: BUYER.owner, subcontractId: id })).status).toBe('closed');
        expect(kit.packages.closed).toHaveLength(1);
    });
});

describe('AttachSignedScanUseCase', () => {
    it('attaches a scan the caller uploaded; another user\'s file is refused', async () => {
        const kit = contractsKit();
        const id = await kit.award();
        const mine = kit.files.add(BUYER.owner, 'contract_scan', 'scan.pdf');
        const theirs = kit.files.add(BUYER.admin, 'contract_scan');
        expect(codeOf(await kit.attachScan.execute({ userId: BUYER.owner, subcontractId: id, fileId: theirs.id }))).toBe('unprocessable');
        expect(codeOf(await kit.attachScan.execute({ userId: BUYER.viewer, subcontractId: id, fileId: mine.id }))).toBe('forbidden');
        const dto = must(await kit.attachScan.execute({ userId: BUYER.owner, subcontractId: id, fileId: mine.id }));
        expect(dto.signedScan?.id).toBe(mine.id);
        expect(dto.documentPdf).toBeNull();
    });
});

describe('RateSubcontractUseCase', () => {
    it('either side rates once after the work ended, with its own score keys', async () => {
        const kit = contractsKit();
        const id = await activeContract(kit);
        expect(codeOf(await kit.rate.execute({ userId: BUYER.owner, subcontractId: id, scores: { quality: 5 }, comment: '' }))).toBe('conflict');
        must(await kit.terminate.execute({ userId: BUYER.owner, subcontractId: id, reason: 'x' }));
        expect(codeOf(await kit.rate.execute({ userId: BUYER.owner, subcontractId: id, scores: { payment: 5 }, comment: '' }))).toBe('unprocessable');
        expect(codeOf(await kit.rate.execute({ userId: BUYER.owner, subcontractId: id, scores: {}, comment: '' }))).toBe('unprocessable');
        expect(codeOf(await kit.rate.execute({ userId: BUYER.owner, subcontractId: id, scores: { quality: 4, time: 2 }, comment: 'ช้า' }))).toBe('ok');
        expect(codeOf(await kit.rate.execute({ userId: BUYER.admin, subcontractId: id, scores: { quality: 4 }, comment: '' }))).toBe('conflict');
        expect(codeOf(await kit.rate.execute({ userId: VENDOR.viewer, subcontractId: id, scores: { payment: 4 }, comment: '' }))).toBe('forbidden');
        expect(codeOf(await kit.rate.execute({ userId: VENDOR.owner, subcontractId: id, scores: { payment: 3, communication: 4 }, comment: '' }))).toBe('ok');
        expect(must(await kit.get.execute({ userId: VENDOR.owner, subcontractId: id })).myRating.submitted).toBe(true);
        expect((await kit.vendorStats.forBuyer(BUYER_WS, [VENDOR_WS])).get(VENDOR_WS)?.ratingFromUs).toBe(3);
    });
});

describe('Price visibility and module state in the contract views', () => {
    it('a buyer viewer without sc.readPrices reads the contract with every money figure masked; the crew sees them', async () => {
        const kit = contractsKit();
        const id = await activeContract(kit);
        await payInstallment(kit, id, 1);
        const masked = must(await kit.get.execute({ userId: BUYER.viewer, subcontractId: id }));
        expect(masked).toMatchObject({ total: 0, paidTotal: 0, retentionBalance: 0, baseTotal: 0, variationsTotal: 0 });
        expect(masked.lines.every(l => l.unitPrice === null && l.matUnitPrice === null && l.total === 0)).toBe(true);
        expect(masked.installments.every(i => i.amount === 0)).toBe(true);
        expect(masked.retention).toMatchObject({ withheld: 0, released: 0, forfeited: 0, balance: 0 });
        const claims = must(await kit.listClaims.execute({ userId: BUYER.viewer, subcontractId: id }));
        expect(claims[0]?.amounts).toMatchObject({ gross: 0, net: 0, retention: 0 });
        expect(claims[0]?.paidAmount).toBe(0);
        expect(must(await kit.listRetention.execute({ userId: BUYER.viewer, subcontractId: id })).every(e => e.amount === 0)).toBe(true);
        expect(must(await kit.listProject.execute({ userId: BUYER.viewer, projectId: PROJECT }))[0]).toMatchObject({ total: 0, paidTotal: 0 });

        const vendor = must(await kit.get.execute({ userId: VENDOR.viewer, subcontractId: id }));
        expect(vendor).toMatchObject({ total: 500_000, baseTotal: 500_000 });
        expect(must(await kit.listVendor.execute({ userId: VENDOR.viewer, workspaceId: VENDOR_WS }))[0]?.total).toBe(500_000);
        expect(must(await kit.get.execute({ userId: BUYER.owner, subcontractId: id })).total).toBe(500_000);

        await kit.settingsRepo.put(BUYER_WS, { ...(await kit.settings.get(BUYER_WS)), viewerSeesPrices: true }, BUYER.owner, kit.clock.now());
        expect(must(await kit.get.execute({ userId: BUYER.viewer, subcontractId: id })).total).toBe(500_000);
    });

    it('buyerModuleOn tells both sides whether the buyer still has the module on', async () => {
        const kit = contractsKit();
        const id = await kit.award();
        expect(must(await kit.get.execute({ userId: VENDOR.owner, subcontractId: id })).buyerModuleOn).toBe(true);
        expect(must(await kit.get.execute({ userId: BUYER.owner, subcontractId: id })).buyerModuleOn).toBe(true);
        kit.flags.set(BUYER_WS, 'subcontracting', false);
        expect(must(await kit.get.execute({ userId: VENDOR.owner, subcontractId: id })).buyerModuleOn).toBe(false);
    });
});
