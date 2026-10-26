import type { Role } from '@contrack/contract';
import { asClaimId, type ClaimId, type SubcontractId } from '../../../shared/ids';
import {
    BUYER, BUYER_WS, OUTSIDER, VENDOR, VENDOR_WS, type ContractsKit, activeContract, codeOf, contractsKit, must, payInstallment,
} from '../../testing/contracts-test-kit';

async function claimed(kit: ContractsKit, id: SubcontractId, no = 1): Promise<ClaimId> {
    return asClaimId(must(await kit.requestClaim.execute({ userId: VENDOR.owner, subcontractId: id, installmentNo: no, note: 'เสร็จแล้ว', photoFileIds: [] })).id);
}

const pass = { result: 'pass' as const, checklist: [{ item: 'ผนังได้ดิ่ง', ok: true }], fixes: [], note: '' };

describe('RequestClaimUseCase', () => {
    it('plan acceptance: 40 % of 500,000, retention 5 %, WHT 3 %, no VAT → net 184,000; the buyer is told', async () => {
        const kit = contractsKit();
        const id = await activeContract(kit);
        kit.notifier.sent.length = 0;
        const photo = kit.files.add(VENDOR.owner, 'claim_photo');
        const dto = must(await kit.requestClaim.execute({ userId: VENDOR.owner, subcontractId: id, installmentNo: 1, note: 'ก่อเสร็จ', photoFileIds: [photo.id] }));
        expect(dto).toMatchObject({
            installmentNo: 1, condition: 'ก่ออิฐเสร็จทั้งหลัง', status: 'requested', requestedBy: 'vendor', note: 'ก่อเสร็จ',
            amounts: { gross: 200_000, adjustments: [], retention: 10_000, wht: 6_000, vat: 0, net: 184_000 },
        });
        expect(dto.photos.map(p => p.id)).toEqual([photo.id]);
        expect(kit.notifier.sent).toEqual([{
            template: 'sc.claim_requested', toWorkspaceIds: [BUYER_WS],
            payload: { vendorName: 'ทีมช่างสมชาย', title: 'งานก่ออิฐฉาบปูน', installmentNo: 1, href: `/subcontracting/contracts/${id}` },
        }]);
        const sc = must(await kit.get.execute({ userId: BUYER.owner, subcontractId: id }));
        expect(sc.installments[0]).toMatchObject({ state: 'requested', claimId: dto.id });
        expect(sc.pendingAction).toBe('buyer_inspect');
    });

    it('the buyer may claim on behalf (sc.claims.inspect) without notifying itself', async () => {
        const kit = contractsKit();
        const id = await activeContract(kit);
        kit.notifier.sent.length = 0;
        const dto = must(await kit.requestClaim.execute({ userId: BUYER.estimator, subcontractId: id, installmentNo: 2, note: '', photoFileIds: [] }));
        expect(dto.requestedBy).toBe('buyer');
        expect(kit.notifier.sent).toEqual([]);
        expect(codeOf(await kit.requestClaim.execute({ userId: BUYER.viewer, subcontractId: id, installmentNo: 1, note: '', photoFileIds: [] }))).toBe('forbidden');
    });

    it('refuses: not active, unknown installment, someone else\'s photo, a second open claim, outsiders', async () => {
        const kit = contractsKit();
        const pending = await kit.award();
        expect(codeOf(await kit.requestClaim.execute({ userId: VENDOR.owner, subcontractId: pending, installmentNo: 1, note: '', photoFileIds: [] }))).toBe('conflict');
        const id = await activeContract(kit);
        expect(codeOf(await kit.requestClaim.execute({ userId: VENDOR.owner, subcontractId: id, installmentNo: 3, note: '', photoFileIds: [] }))).toBe('unprocessable');
        const foreign = kit.files.add(BUYER.owner, 'claim_photo');
        expect(codeOf(await kit.requestClaim.execute({ userId: VENDOR.owner, subcontractId: id, installmentNo: 1, note: '', photoFileIds: [foreign.id] }))).toBe('unprocessable');
        await claimed(kit, id);
        expect(codeOf(await kit.requestClaim.execute({ userId: VENDOR.owner, subcontractId: id, installmentNo: 1, note: '', photoFileIds: [] }))).toBe('conflict');
        expect(codeOf(await kit.requestClaim.execute({ userId: OUTSIDER, subcontractId: id, installmentNo: 2, note: '', photoFileIds: [] }))).toBe('not_found');
        expect(codeOf(await kit.requestClaim.execute({ userId: VENDOR.estimator, subcontractId: id, installmentNo: 2, note: '', photoFileIds: [] }))).toBe('forbidden');
    });

    it('buyer module off: the vendor cannot claim (module_disabled)', async () => {
        const kit = contractsKit();
        const id = await activeContract(kit);
        kit.flags.set(BUYER_WS, 'subcontracting', false);
        expect(codeOf(await kit.requestClaim.execute({ userId: VENDOR.owner, subcontractId: id, installmentNo: 1, note: '', photoFileIds: [] }))).toBe('module_disabled');
        expect(codeOf(await kit.listClaims.execute({ userId: VENDOR.owner, subcontractId: id }))).toBe('ok');
    });
});

describe('Inspect → approve → pay', () => {
    it('cannot approve before inspection; a failed inspection is claimed again, then passes', async () => {
        const kit = contractsKit();
        const id = await activeContract(kit);
        const claimId = await claimed(kit, id);
        expect(codeOf(await kit.approve.execute({ userId: BUYER.owner, claimId, adjustments: [] }))).toBe('conflict');
        kit.notifier.sent.length = 0;
        const failed = must(await kit.inspect.execute({ userId: BUYER.estimator, claimId, result: 'fail', checklist: [], fixes: [], note: 'ผนังเอียง' }));
        expect(failed.inspection).toMatchObject({ result: 'fail', note: 'ผนังเอียง', byName: expect.stringContaining('ผู้ใช้') });
        expect(kit.notifier.sent).toEqual([{
            template: 'sc.inspection_result', toWorkspaceIds: [VENDOR_WS],
            payload: { title: 'งานก่ออิฐฉาบปูน', installmentNo: 1, result: 'ไม่ผ่าน', href: `/vendor/contracts/${id}` },
        }]);
        expect(codeOf(await kit.approve.execute({ userId: BUYER.owner, claimId, adjustments: [] }))).toBe('conflict');
        const again = must(await kit.requestClaim.execute({ userId: VENDOR.owner, subcontractId: id, installmentNo: 1, note: 'แก้แล้ว', photoFileIds: [] }));
        expect(again).toMatchObject({ id: claimId, status: 'requested', inspection: null, note: 'แก้แล้ว' });
        must(await kit.inspect.execute({ userId: BUYER.owner, claimId, ...pass }));
        const approved = must(await kit.approve.execute({ userId: BUYER.owner, claimId, adjustments: [{ label: 'ค่าปรับล่าช้า', amount: -1_000 }] }));
        expect(approved.status).toBe('approved');
        expect(approved.amounts).toEqual({ gross: 200_000, adjustments: [{ label: 'ค่าปรับล่าช้า', amount: -1_000 }], retention: 10_000, wht: 5_970, vat: 0, net: 183_030 });
    });

    it.each<[Role, string, string, string]>([
        ['owner', 'ok', 'ok', 'ok'],
        ['admin', 'ok', 'ok', 'ok'],
        ['estimator', 'ok', 'forbidden', 'forbidden'],
        ['viewer', 'forbidden', 'forbidden', 'forbidden'],
    ])('buyer %s: inspect %s, approve %s, pay %s', async (role, inspect, approve, pay) => {
        const kit = contractsKit();
        const id = await activeContract(kit);
        const claimId = await claimed(kit, id);
        expect(codeOf(await kit.inspect.execute({ userId: BUYER[role], claimId, ...pass }))).toBe(inspect);
        if (inspect !== 'ok') must(await kit.inspect.execute({ userId: BUYER.owner, claimId, ...pass }));
        expect(codeOf(await kit.approve.execute({ userId: BUYER[role], claimId, adjustments: [] }))).toBe(approve);
        if (approve !== 'ok') must(await kit.approve.execute({ userId: BUYER.owner, claimId, adjustments: [] }));
        expect(codeOf(await kit.pay.execute({ userId: BUYER[role], claimId, paidAt: '2026-11-01', amount: 184_000, channel: '', ref: '' }))).toBe(pay);
    });

    it('vendors cannot inspect, approve, pay or reject', async () => {
        const kit = contractsKit();
        const id = await activeContract(kit);
        const claimId = await claimed(kit, id);
        expect(codeOf(await kit.inspect.execute({ userId: VENDOR.owner, claimId, ...pass }))).toBe('forbidden');
        expect(codeOf(await kit.reject.execute({ userId: VENDOR.owner, claimId, reason: 'x' }))).toBe('forbidden');
        expect(codeOf(await kit.inspect.execute({ userId: OUTSIDER, claimId, ...pass }))).toBe('not_found');
    });

    it('estimator approves when the workspace allows it', async () => {
        const kit = contractsKit();
        await kit.settingsRepo.put(BUYER_WS, { ...(await kit.settings.get(BUYER_WS)), estimatorCanApproveClaims: true }, BUYER.owner, kit.clock.now());
        const id = await activeContract(kit);
        const claimId = await claimed(kit, id);
        must(await kit.inspect.execute({ userId: BUYER.owner, claimId, ...pass }));
        expect(codeOf(await kit.approve.execute({ userId: BUYER.estimator, claimId, adjustments: [] }))).toBe('ok');
    });

    it('paying records the payment, withholds the retention and tells the crew', async () => {
        const kit = contractsKit();
        const id = await activeContract(kit);
        const claimId = await claimed(kit, id);
        must(await kit.inspect.execute({ userId: BUYER.owner, claimId, ...pass }));
        expect(codeOf(await kit.pay.execute({ userId: BUYER.owner, claimId, paidAt: '2026-11-01', amount: 184_000, channel: '', ref: '' }))).toBe('conflict');
        must(await kit.approve.execute({ userId: BUYER.owner, claimId, adjustments: [] }));
        kit.notifier.sent.length = 0;
        const paid = must(await kit.pay.execute({ userId: BUYER.owner, claimId, paidAt: '2026-11-01', amount: 184_000, channel: 'โอน', ref: 'SLIP1' }));
        expect(paid).toMatchObject({ status: 'paid', paidAt: '2026-11-01', paidAmount: 184_000, paidChannel: 'โอน', paidRef: 'SLIP1' });
        expect(must(await kit.listRetention.execute({ userId: VENDOR.viewer, subcontractId: id }))).toEqual([
            expect.objectContaining({ kind: 'withheld', amount: 10_000, claimId }),
        ]);
        expect(kit.notifier.sent).toEqual([{
            template: 'sc.claim_paid', toWorkspaceIds: [VENDOR_WS],
            payload: { title: 'งานก่ออิฐฉาบปูน', installmentNo: 1, amount: '184,000 บาท', href: `/vendor/contracts/${id}` },
        }]);
        const sc = must(await kit.get.execute({ userId: VENDOR.owner, subcontractId: id }));
        expect(sc).toMatchObject({ paidTotal: 184_000, retentionBalance: 10_000, nextInstallment: 2 });
        expect(codeOf(await kit.pay.execute({ userId: BUYER.owner, claimId, paidAt: '2026-11-01', amount: 1, channel: '', ref: '' }))).toBe('conflict');
    });

    it('adds VAT when the crew is VAT-registered', async () => {
        const kit = contractsKit();
        const card = kit.vendors.cardsById.get(VENDOR_WS)!;
        kit.vendors.cardsById.set(VENDOR_WS, { ...card, vatRegistered: true });
        const id = await activeContract(kit);
        const dto = must(await kit.requestClaim.execute({ userId: VENDOR.owner, subcontractId: id, installmentNo: 1, note: '', photoFileIds: [] }));
        expect(dto.amounts).toMatchObject({ vat: 14_000, net: 198_000 });
    });
});

describe('Open fixes (settings.fixesBlockNextClaim)', () => {
    it('blocks approval of a later installment until the fixes are marked done by a follow-up inspection', async () => {
        const kit = contractsKit();
        const id = await activeContract(kit);
        const first = await claimed(kit, id, 1);
        must(await kit.inspect.execute({ userId: BUYER.owner, claimId: first, result: 'pass_with_fixes', checklist: [], fixes: [{ text: 'อุดรอยร้าว', done: false }], note: '' }));
        must(await kit.approve.execute({ userId: BUYER.owner, claimId: first, adjustments: [] }));
        const second = await claimed(kit, id, 2);
        must(await kit.inspect.execute({ userId: BUYER.owner, claimId: second, ...pass }));
        const blocked = await kit.approve.execute({ userId: BUYER.owner, claimId: second, adjustments: [] });
        expect(!blocked.ok && blocked.error).toMatchObject({ code: 'conflict', details: { reason: 'open_fixes', installmentNo: 1 } });

        kit.notifier.sent.length = 0;
        const followUp = must(await kit.inspect.execute({
            userId: BUYER.owner, claimId: first, result: 'pass_with_fixes', checklist: [], fixes: [{ text: 'อุดรอยร้าว', done: true }], note: 'แก้แล้ว',
        }));
        expect(followUp).toMatchObject({ status: 'approved', inspection: { result: 'pass_with_fixes', fixes: [{ done: true }], note: 'แก้แล้ว' } });
        expect(followUp.amounts.net).toBe(184_000);
        expect(kit.notifier.sent).toEqual([]);
        expect(codeOf(await kit.approve.execute({ userId: BUYER.owner, claimId: second, adjustments: [] }))).toBe('ok');
    });

    it('a follow-up on an approved claim never changes its result or status; off in settings → no block', async () => {
        const kit = contractsKit();
        await kit.settingsRepo.put(BUYER_WS, { ...(await kit.settings.get(BUYER_WS)), fixesBlockNextClaim: false }, BUYER.owner, kit.clock.now());
        const id = await activeContract(kit);
        const first = await claimed(kit, id, 1);
        must(await kit.inspect.execute({ userId: BUYER.owner, claimId: first, result: 'pass_with_fixes', checklist: [], fixes: [{ text: 'x', done: false }], note: '' }));
        must(await kit.approve.execute({ userId: BUYER.owner, claimId: first, adjustments: [] }));
        const after = must(await kit.inspect.execute({ userId: BUYER.owner, claimId: first, result: 'fail', checklist: [], fixes: [{ text: 'x', done: false }], note: '' }));
        expect(after).toMatchObject({ status: 'approved', inspection: { result: 'pass_with_fixes' } });
        const second = await claimed(kit, id, 2);
        must(await kit.inspect.execute({ userId: BUYER.owner, claimId: second, ...pass }));
        expect(codeOf(await kit.approve.execute({ userId: BUYER.owner, claimId: second, adjustments: [] }))).toBe('ok');
    });
});

describe('RejectClaimUseCase', () => {
    it('rejects a requested / inspected claim; the installment can be claimed anew', async () => {
        const kit = contractsKit();
        const id = await activeContract(kit);
        const claimId = await claimed(kit, id);
        expect(codeOf(await kit.reject.execute({ userId: BUYER.viewer, claimId, reason: 'x' }))).toBe('forbidden');
        expect(must(await kit.reject.execute({ userId: BUYER.estimator, claimId, reason: 'ยังไม่เสร็จ' }))).toMatchObject({ status: 'rejected', rejectedReason: 'ยังไม่เสร็จ' });
        expect(codeOf(await kit.reject.execute({ userId: BUYER.owner, claimId, reason: 'x' }))).toBe('conflict');
        const fresh = await claimed(kit, id);
        expect(fresh).not.toBe(claimId);
        expect(must(await kit.listClaims.execute({ userId: BUYER.viewer, subcontractId: id })).map(c => c.status)).toEqual(['rejected', 'requested']);
    });

    it('cannot reject an approved claim', async () => {
        const kit = contractsKit();
        const id = await activeContract(kit);
        await payInstallment(kit, id, 1);
        const [claim] = must(await kit.listClaims.execute({ userId: BUYER.owner, subcontractId: id }));
        expect(codeOf(await kit.reject.execute({ userId: BUYER.owner, claimId: asClaimId(claim!.id), reason: 'x' }))).toBe('conflict');
    });
});
