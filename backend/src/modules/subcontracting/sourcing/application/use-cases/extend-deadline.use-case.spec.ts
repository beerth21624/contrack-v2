import { MASONRY_KEYS, SourcingKit, USERS, codeOf, describeBuyerAuthorization, valueOf } from '../../testing/sourcing-test-kit';
import { ExtendDeadlineUseCase } from './extend-deadline.use-case';

const LATER = new Date('2026-01-20T10:00:00.000Z');

describe('ExtendDeadlineUseCase', () => {
    it('moves the deadline, renews the links and re-arms the reminder', async () => {
        const kit = await SourcingKit.create();
        const { pkg, invitationId } = await kit.sentPackage();
        const inv = await kit.invitations.findById(invitationId);
        inv?.markReminded(kit.clock.now());
        if (inv !== undefined) await kit.invitations.update(inv);
        const dto = valueOf(await kit.get(ExtendDeadlineUseCase).execute({ actorId: USERS.owner, packageId: pkg.id as never, bidDeadline: LATER }));
        expect(dto.bidDeadline).toBe(LATER.toISOString());
        const after = await kit.invitations.findById(invitationId);
        expect(after?.props.expiresAt.toISOString()).toBe('2026-02-19T10:00:00.000Z');
        expect(after?.props.deadlineSoonAt).toBeNull();
    });

    it('reopens an expired package', async () => {
        const kit = await SourcingKit.create();
        const { pkg } = await kit.sentPackage();
        kit.clock.set(new Date('2026-01-08T00:00:00.000Z'));
        const dto = valueOf(await kit.get(ExtendDeadlineUseCase).execute({ actorId: USERS.owner, packageId: pkg.id as never, bidDeadline: LATER }));
        expect(dto.status).toBe('open');
        expect(kit.activity.rows.map(r => r.action)).toContain('package.extended');
    });

    it('refuses an earlier deadline or one in the past (422) and a draft (conflict)', async () => {
        const kit = await SourcingKit.create();
        const { pkg } = await kit.sentPackage();
        const uc = kit.get(ExtendDeadlineUseCase);
        expect(codeOf(await uc.execute({ actorId: USERS.owner, packageId: pkg.id as never, bidDeadline: new Date('2026-01-05T00:00:00.000Z') })))
            .toBe('unprocessable');
        kit.clock.set(new Date('2026-01-30T00:00:00.000Z'));
        expect(codeOf(await uc.execute({ actorId: USERS.owner, packageId: pkg.id as never, bidDeadline: LATER }))).toBe('unprocessable');
        const draft = await kit.draft({ lineKeys: MASONRY_KEYS.slice(3, 5) });
        expect(codeOf(await uc.execute({ actorId: USERS.owner, packageId: draft.id as never, bidDeadline: new Date('2026-03-01T00:00:00.000Z') })))
            .toBe('conflict');
    });

    it('an award that committed before the extend got the row lock is never reopened (conflict)', async () => {
        const kit = await SourcingKit.create();
        const { pkg } = await kit.sentPackage();
        const lock = kit.packages.lockById.bind(kit.packages);
        jest.spyOn(kit.packages, 'lockById').mockImplementation(async id => {
            const row = kit.packages.rows.get(id);
            if (row !== undefined) kit.packages.rows.set(id, { ...row, status: 'awarded' });
            return lock(id);
        });
        expect(codeOf(await kit.get(ExtendDeadlineUseCase).execute({ actorId: USERS.owner, packageId: pkg.id as never, bidDeadline: LATER })))
            .toBe('conflict');
        expect((await kit.packages.findById(pkg.id as never))?.status).toBe('awarded');
    });

    describeBuyerAuthorization(['owner', 'admin', 'estimator'], k => k.sentPackage(),
        (k, user, s) => k.get(ExtendDeadlineUseCase).execute({ actorId: user, packageId: s.pkg.id as never, bidDeadline: LATER }));
});
