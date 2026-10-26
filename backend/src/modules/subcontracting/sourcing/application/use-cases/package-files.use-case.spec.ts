import { SourcingKit, USERS, codeOf, describeBuyerAuthorization, valueOf } from '../../testing/sourcing-test-kit';
import { AttachPackageFileUseCase } from './attach-package-file.use-case';
import { RemovePackageFileUseCase } from './remove-package-file.use-case';

describe('AttachPackageFileUseCase', () => {
    it('attaches a file the caller uploaded (idempotent)', async () => {
        const kit = await SourcingKit.create();
        const draft = await kit.draft();
        const file = kit.files.add(USERS.owner);
        const uc = kit.get(AttachPackageFileUseCase);
        valueOf(await uc.execute({ actorId: USERS.owner, packageId: draft.id as never, fileId: file.id }));
        const dto = valueOf(await uc.execute({ actorId: USERS.owner, packageId: draft.id as never, fileId: file.id }));
        expect(dto.files.map(f => f.id)).toEqual([file.id]);
        expect(kit.notifier.sent).toHaveLength(0);
    });

    it('a file added after sending is announced in-app to the linked invitees', async () => {
        const kit = await SourcingKit.create();
        await kit.seedVendorProfile();
        const { pkg } = await kit.sentPackage();
        kit.notifier.sent.length = 0;
        const file = kit.files.add(USERS.owner);
        valueOf(await kit.get(AttachPackageFileUseCase).execute({ actorId: USERS.owner, packageId: pkg.id as never, fileId: file.id }));
        expect(kit.notifier.templates()).toEqual(['sc.addendum']);
    });

    it("refuses someone else's upload (422) and a cancelled package (conflict)", async () => {
        const kit = await SourcingKit.create();
        const draft = await kit.draft();
        const other = kit.files.add(USERS.admin);
        expect(codeOf(await kit.get(AttachPackageFileUseCase).execute({ actorId: USERS.owner, packageId: draft.id as never, fileId: other.id })))
            .toBe('unprocessable');
        const stored = await kit.packages.findById(draft.id as never);
        stored?.cancel('x', kit.clock.now());
        if (stored !== undefined) await kit.packages.update(stored);
        const mine = kit.files.add(USERS.owner);
        expect(codeOf(await kit.get(AttachPackageFileUseCase).execute({ actorId: USERS.owner, packageId: draft.id as never, fileId: mine.id })))
            .toBe('conflict');
    });

    describeBuyerAuthorization(['owner', 'admin', 'estimator'], async k => ({ d: await k.draft() }),
        (k, user, { d }) => k.get(AttachPackageFileUseCase).execute({ actorId: user, packageId: d.id as never, fileId: k.files.add(user).id }));
});

describe('RemovePackageFileUseCase', () => {
    const withFile = async (kit: SourcingKit) => {
        const d = await kit.draft();
        const file = kit.files.add(USERS.owner);
        valueOf(await kit.get(AttachPackageFileUseCase).execute({ actorId: USERS.owner, packageId: d.id as never, fileId: file.id }));
        return { d, fileId: file.id };
    };

    it('removes a file of a draft; an unknown file → not_found', async () => {
        const kit = await SourcingKit.create();
        const { d, fileId } = await withFile(kit);
        const uc = kit.get(RemovePackageFileUseCase);
        expect(valueOf(await uc.execute({ actorId: USERS.owner, packageId: d.id as never, fileId })).files).toEqual([]);
        expect(codeOf(await uc.execute({ actorId: USERS.owner, packageId: d.id as never, fileId }))).toBe('not_found');
    });

    it('a sent package keeps its files (conflict)', async () => {
        const kit = await SourcingKit.create();
        const { d, fileId } = await withFile(kit);
        await kit.send(d.id, [await kit.entry()]);
        expect(codeOf(await kit.get(RemovePackageFileUseCase).execute({ actorId: USERS.owner, packageId: d.id as never, fileId }))).toBe('conflict');
    });

    describeBuyerAuthorization(['owner', 'admin', 'estimator'], withFile,
        (k, user, { d, fileId }) => k.get(RemovePackageFileUseCase).execute({ actorId: user, packageId: d.id as never, fileId }));
});
