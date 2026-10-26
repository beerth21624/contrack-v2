import { asVariationId } from '../../../shared/ids';
import {
    BUYER, BUYER_WS, OUTSIDER, PROJECT, VENDOR, VENDOR_WS, activeContract, codeOf, contractsKit, must, payInstallment,
} from '../../testing/contracts-test-kit';

const lines = [{ desc: 'ก่ออิฐเพิ่มห้องเก็บของ', unit: 'ตร.ม.', qty: 20, unitPrice: 150 }, { desc: 'ตัดงานฉาบรั้ว', unit: 'ตร.ม.', qty: -10, unitPrice: 100 }];

describe('Variations', () => {
    it('buyer proposes (active only); the crew is told and accepts → value and last installment change', async () => {
        const kit = contractsKit();
        const pending = await kit.award();
        expect(codeOf(await kit.proposeVariation.execute({ userId: BUYER.owner, subcontractId: pending, lines, reason: 'x' }))).toBe('conflict');
        const id = await activeContract(kit);
        kit.notifier.sent.length = 0;
        const v = must(await kit.proposeVariation.execute({ userId: BUYER.estimator, subcontractId: id, lines, reason: 'ลูกค้าขอเพิ่ม' }));
        expect(v).toMatchObject({ proposedBy: 'buyer', amount: 2_000, status: 'proposed', lines: [{ total: 3_000 }, { total: -1_000 }] });
        expect(kit.notifier.sent).toEqual([{
            template: 'sc.variation_proposed', toWorkspaceIds: [VENDOR_WS],
            payload: { title: 'งานก่ออิฐฉาบปูน', amount: '2,000 บาท', href: `/vendor/contracts/${id}` },
        }]);
        // Waiting for the OTHER side: the crew is asked to answer, the buyer (who proposed it) is not.
        expect(must(await kit.get.execute({ userId: VENDOR.owner, subcontractId: id })).pendingAction).toBe('variation_response');
        expect(must(await kit.get.execute({ userId: BUYER.owner, subcontractId: id })).pendingAction).toBe('none');
        expect(must(await kit.listVendor.execute({ userId: VENDOR.viewer, workspaceId: VENDOR_WS })).find(s => s.id === id)?.pendingAction).toBe('variation_response');
        expect(must(await kit.listProject.execute({ userId: BUYER.owner, projectId: PROJECT })).find(s => s.id === id)?.pendingAction).toBe('none');

        const variationId = asVariationId(v.id);
        expect(codeOf(await kit.respondVariation.execute({ userId: BUYER.owner, variationId, accept: true }))).toBe('forbidden');
        expect(codeOf(await kit.respondVariation.execute({ userId: VENDOR.estimator, variationId, accept: true }))).toBe('forbidden');
        kit.notifier.sent.length = 0;
        const answered = must(await kit.respondVariation.execute({ userId: VENDOR.owner, variationId, accept: true }));
        expect(answered).toMatchObject({ status: 'accepted', decidedAt: kit.clock.now().toISOString() });
        expect(kit.notifier.sent[0]).toMatchObject({ template: 'sc.variation_answered', toWorkspaceIds: [BUYER_WS], payload: { accepted: 'ยอมรับ' } });
        const sc = must(await kit.get.execute({ userId: BUYER.owner, subcontractId: id }));
        expect(sc).toMatchObject({ baseTotal: 500_000, variationsTotal: 2_000, total: 502_000 });
        expect(sc.installments.map(i => i.amount)).toEqual([200_000, 302_000]);
        expect(codeOf(await kit.respondVariation.execute({ userId: VENDOR.owner, variationId, accept: false }))).toBe('conflict');
    });

    it('vendor proposes, buyer rejects: nothing changes', async () => {
        const kit = contractsKit();
        const id = await activeContract(kit);
        const v = must(await kit.proposeVariation.execute({ userId: VENDOR.admin, subcontractId: id, lines, reason: 'งานเพิ่ม' }));
        expect(codeOf(await kit.respondVariation.execute({ userId: BUYER.viewer, variationId: asVariationId(v.id), accept: false }))).toBe('forbidden');
        expect(must(await kit.respondVariation.execute({ userId: BUYER.owner, variationId: asVariationId(v.id), accept: false })).status).toBe('rejected');
        expect(must(await kit.get.execute({ userId: BUYER.owner, subcontractId: id })).total).toBe(500_000);
        expect(must(await kit.listVariations.execute({ userId: VENDOR.viewer, subcontractId: id }))).toHaveLength(1);
        expect(codeOf(await kit.listVariations.execute({ userId: OUTSIDER, subcontractId: id }))).toBe('not_found');
    });

    it('refuses a value change once the last installment is approved, and a negative last installment', async () => {
        const kit = contractsKit();
        const id = await activeContract(kit);
        const big = must(await kit.proposeVariation.execute({ userId: BUYER.owner, subcontractId: id, lines: [{ desc: 'ตัดงาน', unit: 'งาน', qty: -1, unitPrice: 400_000 }], reason: 'x' }));
        expect(codeOf(await kit.respondVariation.execute({ userId: VENDOR.owner, variationId: asVariationId(big.id), accept: true }))).toBe('unprocessable');
        await payInstallment(kit, id, 2);
        const late = must(await kit.proposeVariation.execute({ userId: BUYER.owner, subcontractId: id, lines, reason: 'x' }));
        const r = await kit.respondVariation.execute({ userId: VENDOR.owner, variationId: asVariationId(late.id), accept: true });
        expect(!r.ok && r.error).toMatchObject({ code: 'conflict', details: { reason: 'last_installment_approved' } });
    });

    it('vendor writes need the buyer module on', async () => {
        const kit = contractsKit();
        const id = await activeContract(kit);
        kit.flags.set(BUYER_WS, 'subcontracting', false);
        expect(codeOf(await kit.proposeVariation.execute({ userId: VENDOR.owner, subcontractId: id, lines, reason: 'x' }))).toBe('module_disabled');
        expect(codeOf(await kit.listVariations.execute({ userId: VENDOR.owner, subcontractId: id }))).toBe('ok');
    });
});
