// Every write on a subcontract locks its row FIRST and decides on the locked state: UnitOfWork.run commits even when the
// work returns an error, so nothing may be written before the checks. In memory the race is simulated by running the
// competing request at the moment the lock is taken (the Postgres lock would make it finish first).
import { asClaimId, asVariationId, type SubcontractId } from '../../../shared/ids';
import {
    BUYER, VENDOR, activeContract, codeOf, contractsKit, masonryLines, must, payInstallment, type ContractsKit,
} from '../../testing/contracts-test-kit';

/** The lock was taken, and before every write. */
function lockedBeforeWrites(lock: jest.SpyInstance, writes: jest.SpyInstance[]): void {
    expect(lock).toHaveBeenCalled();
    const first = Math.min(...lock.mock.invocationCallOrder);
    const orders = writes.flatMap(w => w.mock.invocationCallOrder);
    expect(orders.length).toBeGreaterThan(0);
    for (const o of orders) expect(o).toBeGreaterThan(first);
}

/** The next lockForUpdate first lets `competitor` complete (it got the lock first), then returns the fresh row. */
function raceOnLock(kit: ContractsKit, competitor: () => Promise<unknown>): void {
    const real = kit.subcontracts.lockForUpdate.bind(kit.subcontracts);
    jest.spyOn(kit.subcontracts, 'lockForUpdate').mockImplementationOnce(async id => {
        await competitor();
        return real(id);
    });
}

function raceOnPackageLock(kit: ContractsKit, competitor: () => Promise<unknown>): void {
    const real = kit.subcontracts.lockByPackage.bind(kit.subcontracts);
    jest.spyOn(kit.subcontracts, 'lockByPackage').mockImplementationOnce(async (ws, pkg) => {
        await competitor();
        return real(ws, pkg);
    });
}

async function completed(kit: ContractsKit): Promise<SubcontractId> {
    const id = await activeContract(kit);
    await payInstallment(kit, id, 1);
    await payInstallment(kit, id, 2);
    must(await kit.complete.execute({ userId: BUYER.owner, subcontractId: id }));
    return id;
}

describe('Locking: the subcontract row is locked before anything is written', () => {
    it('accept, document, change request, scan', async () => {
        const kit = contractsKit();
        const id = await kit.award();
        const lock = jest.spyOn(kit.subcontracts, 'lockForUpdate');
        const update = jest.spyOn(kit.subcontracts, 'update');
        const insertDoc = jest.spyOn(kit.documents, 'insertDocument');
        const insertChange = jest.spyOn(kit.documents, 'insertChangeRequest');

        must(await kit.requestChange.execute({ userId: VENDOR.owner, subcontractId: id, text: 'ขอแก้ค่าปรับ' }));
        lockedBeforeWrites(lock, [insertChange]);
        lock.mockClear();
        must(await kit.updateDocument.execute({ userId: BUYER.owner, subcontractId: id, html: '<p>สัญญาใหม่</p>' }));
        lockedBeforeWrites(lock, [insertDoc, update]);
        lock.mockClear();
        update.mockClear();
        must(await kit.accept.execute({ userId: VENDOR.owner, subcontractId: id, documentVersion: 2, ip: null }));
        lockedBeforeWrites(lock, [update]);
        lock.mockClear();
        update.mockClear();
        const scan = kit.files.add(BUYER.owner, 'contract_scan', 'scan.pdf');
        must(await kit.attachScan.execute({ userId: BUYER.owner, subcontractId: id, fileId: scan.id }));
        lockedBeforeWrites(lock, [update]);
    });

    it('claims: request, inspect, approve, pay, reject', async () => {
        const kit = contractsKit();
        const id = await activeContract(kit);
        const lock = jest.spyOn(kit.subcontracts, 'lockForUpdate');
        const insert = jest.spyOn(kit.claims, 'insert');
        const update = jest.spyOn(kit.claims, 'update');
        const withheld = jest.spyOn(kit.retention, 'insert');
        const claim = must(await kit.requestClaim.execute({ userId: VENDOR.owner, subcontractId: id, installmentNo: 1, note: '', photoFileIds: [] }));
        lockedBeforeWrites(lock, [insert]);
        const claimId = asClaimId(claim.id);
        for (const step of [
            () => kit.inspect.execute({ userId: BUYER.owner, claimId, result: 'pass', checklist: [], fixes: [], note: '' }),
            () => kit.approve.execute({ userId: BUYER.owner, claimId, adjustments: [] }),
            () => kit.pay.execute({ userId: BUYER.owner, claimId, paidAt: '2026-11-10', amount: claim.amounts.net, channel: '', ref: '' }),
        ]) {
            lock.mockClear();
            update.mockClear();
            must(await step());
            lockedBeforeWrites(lock, [update]);
        }
        lockedBeforeWrites(lock, [withheld]);
        const second = must(await kit.requestClaim.execute({ userId: VENDOR.owner, subcontractId: id, installmentNo: 2, note: '', photoFileIds: [] }));
        lock.mockClear();
        update.mockClear();
        must(await kit.reject.execute({ userId: BUYER.owner, claimId: asClaimId(second.id), reason: 'ยังไม่เสร็จ' }));
        lockedBeforeWrites(lock, [update]);
    });

    it('variations, retention moves, ratings, complete; cancel / terminate / close lock the whole package', async () => {
        const kit = contractsKit();
        const id = await activeContract(kit);
        const lock = jest.spyOn(kit.subcontracts, 'lockForUpdate');
        const lockPackage = jest.spyOn(kit.subcontracts, 'lockByPackage');
        const update = jest.spyOn(kit.subcontracts, 'update');
        const insertVariation = jest.spyOn(kit.variations, 'insert');
        const updateVariation = jest.spyOn(kit.variations, 'update');
        const insertEntry = jest.spyOn(kit.retention, 'insert');
        const insertRating = jest.spyOn(kit.ratings, 'insert');

        const v = must(await kit.proposeVariation.execute({ userId: BUYER.owner, subcontractId: id, lines: [{ desc: 'เพิ่ม', unit: 'งาน', qty: 1, unitPrice: 1_000 }], reason: 'x' }));
        lockedBeforeWrites(lock, [insertVariation]);
        lock.mockClear();
        must(await kit.respondVariation.execute({ userId: VENDOR.owner, variationId: asVariationId(v.id), accept: true }));
        lockedBeforeWrites(lock, [updateVariation, update]);

        await payInstallment(kit, id, 1);
        await payInstallment(kit, id, 2);
        lock.mockClear();
        update.mockClear();
        must(await kit.complete.execute({ userId: BUYER.owner, subcontractId: id }));
        lockedBeforeWrites(lock, [update]);
        lock.mockClear();
        insertEntry.mockClear();
        const balance = must(await kit.get.execute({ userId: BUYER.owner, subcontractId: id })).retention.balance;
        must(await kit.moveRetention.execute({ userId: BUYER.owner, subcontractId: id, kind: 'released', amount: balance, note: '' }));
        lockedBeforeWrites(lock, [insertEntry]);
        update.mockClear();
        must(await kit.close.execute({ userId: BUYER.owner, subcontractId: id }));
        lockedBeforeWrites(lockPackage, [update]);
        lock.mockClear();
        must(await kit.rate.execute({ userId: BUYER.owner, subcontractId: id, scores: { quality: 5 }, comment: '' }));
        lockedBeforeWrites(lock, [insertRating]);

        const other = await activeContract(kit);
        lockPackage.mockClear();
        update.mockClear();
        must(await kit.terminate.execute({ userId: BUYER.owner, subcontractId: other, reason: 'ทิ้งงาน' }));
        lockedBeforeWrites(lockPackage, [update]);
        const pending = await kit.award();
        lockPackage.mockClear();
        update.mockClear();
        must(await kit.cancel.execute({ userId: BUYER.owner, subcontractId: pending, reason: 'x' }));
        lockedBeforeWrites(lockPackage, [update]);
    });
});

describe('Concurrency: the second of two requests at once is refused (409) and writes nothing', () => {
    it('accept twice → the second gets conflict', async () => {
        const kit = contractsKit();
        const id = await kit.award();
        raceOnLock(kit, () => kit.accept.execute({ userId: VENDOR.owner, subcontractId: id, documentVersion: 1, ip: null }));
        expect(codeOf(await kit.accept.execute({ userId: VENDOR.admin, subcontractId: id, documentVersion: 1, ip: null }))).toBe('conflict');
        expect(kit.activity.rows.filter(r => r.action === 'accepted')).toHaveLength(1);
    });

    it('the buyer cancels while the crew accepts → conflict; the contract stays active, the package is not reopened', async () => {
        const kit = contractsKit();
        const id = await kit.award();
        raceOnPackageLock(kit, () => kit.accept.execute({ userId: VENDOR.owner, subcontractId: id, documentVersion: 1, ip: null }));
        expect(codeOf(await kit.cancel.execute({ userId: BUYER.owner, subcontractId: id, reason: 'x' }))).toBe('conflict');
        expect((await kit.subcontracts.findById(id))?.status).toBe('active');
        expect(kit.packages.reopened).toEqual([]);
        expect(kit.bids.resets).toEqual([]);
    });

    it('the buyer edits the document while the crew accepts → conflict, no new version', async () => {
        const kit = contractsKit();
        const id = await kit.award();
        raceOnLock(kit, () => kit.accept.execute({ userId: VENDOR.owner, subcontractId: id, documentVersion: 1, ip: null }));
        expect(codeOf(await kit.updateDocument.execute({ userId: BUYER.owner, subcontractId: id, html: '<p>ใหม่</p>' }))).toBe('conflict');
        expect(await kit.documents.findDocument(id, 2)).toBeUndefined();
    });

    it('two claims on one installment at once → one claim, the second gets conflict', async () => {
        const kit = contractsKit();
        const id = await activeContract(kit);
        const request = (userId = VENDOR.owner) => kit.requestClaim.execute({ userId, subcontractId: id, installmentNo: 1, note: '', photoFileIds: [] });
        raceOnLock(kit, () => request());
        expect(codeOf(await request(BUYER.owner))).toBe('conflict');
        expect(await kit.claims.listBySubcontracts([id])).toHaveLength(1);
    });

    it('double payment → the second gets conflict and the retention is withheld once', async () => {
        const kit = contractsKit();
        const id = await activeContract(kit);
        const claim = must(await kit.requestClaim.execute({ userId: VENDOR.owner, subcontractId: id, installmentNo: 1, note: '', photoFileIds: [] }));
        const claimId = asClaimId(claim.id);
        must(await kit.inspect.execute({ userId: BUYER.owner, claimId, result: 'pass', checklist: [], fixes: [], note: '' }));
        must(await kit.approve.execute({ userId: BUYER.owner, claimId, adjustments: [] }));
        const pay = () => kit.pay.execute({ userId: BUYER.owner, claimId, paidAt: '2026-11-10', amount: claim.amounts.net, channel: '', ref: '' });
        raceOnLock(kit, pay);
        expect(codeOf(await pay())).toBe('conflict');
        expect(kit.retention.rows.filter(r => r.kind === 'withheld')).toHaveLength(1);
    });

    it('double approve → conflict; reject while it is being approved → conflict', async () => {
        const kit = contractsKit();
        const id = await activeContract(kit);
        const claim = must(await kit.requestClaim.execute({ userId: VENDOR.owner, subcontractId: id, installmentNo: 1, note: '', photoFileIds: [] }));
        const claimId = asClaimId(claim.id);
        must(await kit.inspect.execute({ userId: BUYER.owner, claimId, result: 'pass', checklist: [], fixes: [], note: '' }));
        const approve = () => kit.approve.execute({ userId: BUYER.owner, claimId, adjustments: [] });
        raceOnLock(kit, approve);
        expect(codeOf(await approve())).toBe('conflict');
        expect(codeOf(await kit.reject.execute({ userId: BUYER.owner, claimId, reason: 'x' }))).toBe('conflict');
        expect((await kit.claims.findById(claimId))?.status).toBe('approved');
    });

    it('a variation answered twice at once → the second gets conflict, the value changes once', async () => {
        const kit = contractsKit();
        const id = await activeContract(kit);
        const v = must(await kit.proposeVariation.execute({ userId: BUYER.owner, subcontractId: id, lines: [{ desc: 'เพิ่ม', unit: 'งาน', qty: 1, unitPrice: 1_000 }], reason: 'x' }));
        const variationId = asVariationId(v.id);
        raceOnLock(kit, () => kit.respondVariation.execute({ userId: VENDOR.owner, variationId, accept: true }));
        expect(codeOf(await kit.respondVariation.execute({ userId: VENDOR.admin, variationId, accept: true }))).toBe('conflict');
        expect((await kit.subcontracts.findById(id))?.total).toBe(501_000);
    });

    it('two releases of the whole balance at once → the second is refused, the balance never goes below 0', async () => {
        const kit = contractsKit();
        const id = await completed(kit);
        const balance = must(await kit.get.execute({ userId: BUYER.owner, subcontractId: id })).retention.balance;
        const release = () => kit.moveRetention.execute({ userId: BUYER.owner, subcontractId: id, kind: 'released', amount: balance, note: '' });
        raceOnLock(kit, release);
        expect(codeOf(await release())).toBe('unprocessable');
        expect(must(await kit.get.execute({ userId: BUYER.owner, subcontractId: id })).retention.balance).toBe(0);
    });

    it('complete twice, close twice, rate twice → conflict', async () => {
        const kit = contractsKit();
        const id = await activeContract(kit);
        await payInstallment(kit, id, 1);
        await payInstallment(kit, id, 2);
        const complete = () => kit.complete.execute({ userId: BUYER.owner, subcontractId: id });
        raceOnLock(kit, complete);
        expect(codeOf(await complete())).toBe('conflict');
        const balance = must(await kit.get.execute({ userId: BUYER.owner, subcontractId: id })).retention.balance;
        must(await kit.moveRetention.execute({ userId: BUYER.owner, subcontractId: id, kind: 'released', amount: balance, note: '' }));
        const close = () => kit.close.execute({ userId: BUYER.owner, subcontractId: id });
        raceOnPackageLock(kit, close);
        expect(codeOf(await close())).toBe('conflict');
        expect(kit.packages.closed).toHaveLength(1);
        const rate = () => kit.rate.execute({ userId: VENDOR.owner, subcontractId: id, scores: { payment: 4 }, comment: '' });
        raceOnLock(kit, rate);
        expect(codeOf(await rate())).toBe('conflict');
    });
});

describe('Claim amounts on the server use the contract labour share', () => {
    it('withholds only on the labour share when the crew supplies material', async () => {
        const kit = contractsKit();
        const id = await activeContract(kit, { lines: masonryLines(2, true), matUnitPrice: 300 });
        const sc = must(await kit.get.execute({ userId: BUYER.owner, subcontractId: id }));
        const labour = sc.lines.reduce((s, l) => s + Math.min(l.total, (l.unitPrice ?? 0) * l.qty), 0);
        const claim = must(await kit.requestClaim.execute({ userId: VENDOR.owner, subcontractId: id, installmentNo: 1, note: '', photoFileIds: [] }));
        expect(claim.amounts.gross).toBe(200_000);
        expect(claim.amounts.wht).toBeCloseTo(200_000 * 0.03 * (labour / 500_000), 1);
        expect(claim.amounts.wht).toBeLessThan(6_000);
    });
});
