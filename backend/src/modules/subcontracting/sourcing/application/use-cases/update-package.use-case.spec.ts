import { ELECTRICAL_KEYS, MASONRY_KEYS, SourcingKit, USERS, codeOf, describeBuyerAuthorization, valueOf } from '../../testing/sourcing-test-kit';
import { UpdatePackageUseCase } from './update-package.use-case';

describe('UpdatePackageUseCase', () => {
    it('changes any field of a draft and re-takes the snapshot when the lines change', async () => {
        const kit = await SourcingKit.create();
        const draft = await kit.draft();
        const dto = valueOf(await kit.get(UpdatePackageUseCase).execute({
            actorId: USERS.estimator, packageId: draft.id as never,
            body: { title: 'ไฟฟ้า', trade: 'electrical', lineKeys: ELECTRICAL_KEYS.slice(0, 2), sourcingMode: 'direct' },
        }));
        expect(dto.title).toBe('ไฟฟ้า');
        expect(dto.sourcingMode).toBe('direct');
        expect(dto.lines.map(l => l.lineKey)).toEqual(ELECTRICAL_KEYS.slice(0, 2));
        expect(dto.version).toBe(1);
        expect(kit.activity.rows.map(r => r.action)).toContain('package.updated');
    });

    it('switching supply to with_materials re-prices the estimate', async () => {
        const kit = await SourcingKit.create();
        const draft = await kit.draft();
        const dto = valueOf(await kit.get(UpdatePackageUseCase).execute({ actorId: USERS.owner, packageId: draft.id as never, body: { supplyMode: 'with_materials' } }));
        expect(dto.lines.every(l => l.materialBy === 'vendor')).toBe(true);
        expect(dto.estimateTotal).toBeGreaterThan(draft.estimateTotal);
    });

    it('draft: unknown keys → 422, sourcingMode open → 422', async () => {
        const kit = await SourcingKit.create();
        const draft = await kit.draft();
        const uc = kit.get(UpdatePackageUseCase);
        expect(codeOf(await uc.execute({ actorId: USERS.owner, packageId: draft.id as never, body: { lineKeys: ['x'] } }))).toBe('unprocessable');
        expect(codeOf(await uc.execute({ actorId: USERS.owner, packageId: draft.id as never, body: { sourcingMode: 'open' } }))).toBe('unprocessable');
    });

    it('after sending: description and a later deadline only (links renewed)', async () => {
        const kit = await SourcingKit.create();
        const { pkg, invitationId } = await kit.sentPackage();
        const uc = kit.get(UpdatePackageUseCase);
        const later = '2026-01-10T10:00:00.000Z';
        const dto = valueOf(await uc.execute({ actorId: USERS.owner, packageId: pkg.id as never, body: { description: 'ใหม่', bidDeadline: later } }));
        expect(dto.description).toBe('ใหม่');
        expect(dto.bidDeadline).toBe(later);
        const inv = await kit.invitations.findById(invitationId);
        expect(inv?.props.expiresAt.toISOString()).toBe('2026-02-09T10:00:00.000Z');

        expect(codeOf(await uc.execute({ actorId: USERS.owner, packageId: pkg.id as never, body: { title: 'x' } }))).toBe('unprocessable');
        expect(codeOf(await uc.execute({ actorId: USERS.owner, packageId: pkg.id as never, body: { lineKeys: MASONRY_KEYS.slice(0, 1) } }))).toBe('unprocessable');
        expect(codeOf(await uc.execute({ actorId: USERS.owner, packageId: pkg.id as never, body: { bidDeadline: '2026-01-02T00:00:00.000Z' } }))).toBe('unprocessable');
    });

    it('an expired package reopens with a later deadline', async () => {
        const kit = await SourcingKit.create();
        const { pkg } = await kit.sentPackage();
        kit.clock.set(new Date('2026-01-08T00:00:00.000Z'));
        const dto = valueOf(await kit.get(UpdatePackageUseCase).execute({
            actorId: USERS.owner, packageId: pkg.id as never, body: { bidDeadline: '2026-01-12T00:00:00.000Z' },
        }));
        expect(dto.status).toBe('open');
    });

    it('a cancelled package cannot change (conflict)', async () => {
        const kit = await SourcingKit.create();
        const { pkg } = await kit.sentPackage();
        const stored = await kit.packages.findById(pkg.id as never);
        stored?.cancel('x', kit.clock.now());
        if (stored !== undefined) await kit.packages.update(stored);
        expect(codeOf(await kit.get(UpdatePackageUseCase).execute({ actorId: USERS.owner, packageId: pkg.id as never, body: { description: 'y' } })))
            .toBe('conflict');
    });

    it('a draft edit to BOQ lines of another live package → conflict { lineKeys } (its own lines stay allowed)', async () => {
        const kit = await SourcingKit.create();
        const draft = await kit.draft({ lineKeys: MASONRY_KEYS.slice(0, 2) });
        await kit.draft({ title: 'อื่น', lineKeys: MASONRY_KEYS.slice(2, 4) });
        const uc = kit.get(UpdatePackageUseCase);
        const res = await uc.execute({ actorId: USERS.owner, packageId: draft.id as never, body: { lineKeys: MASONRY_KEYS.slice(0, 4) } });
        expect(res.ok ? undefined : res.error).toMatchObject({ code: 'conflict', details: { lineKeys: MASONRY_KEYS.slice(2, 4) } });
        expect(codeOf(await uc.execute({ actorId: USERS.owner, packageId: draft.id as never, body: { lineKeys: MASONRY_KEYS.slice(0, 1) } }))).toBe('ok');
    });

    it('an edit decided after an award committed (row re-read under lock) → conflict, the award stays', async () => {
        const kit = await SourcingKit.create();
        const { pkg } = await kit.sentPackage();
        const lock = kit.packages.lockById.bind(kit.packages);
        jest.spyOn(kit.packages, 'lockById').mockImplementation(async id => {
            const row = kit.packages.rows.get(id);
            if (row !== undefined) kit.packages.rows.set(id, { ...row, status: 'awarded' });
            return lock(id);
        });
        expect(codeOf(await kit.get(UpdatePackageUseCase).execute({ actorId: USERS.owner, packageId: pkg.id as never, body: { description: 'x' } })))
            .toBe('conflict');
        expect((await kit.packages.findById(pkg.id as never))?.status).toBe('awarded');
    });

    describeBuyerAuthorization(['owner', 'admin', 'estimator'], k => k.draft(),
        (k, user, d) => k.get(UpdatePackageUseCase).execute({ actorId: user, packageId: d.id as never, body: { title: 'ใหม่' } }));
});
