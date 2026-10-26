import { SourcingKit, USERS, codeOf, describeBuyerAuthorization } from '../../testing/sourcing-test-kit';
import { DeletePackageUseCase } from './delete-package.use-case';

describe('DeletePackageUseCase', () => {
    it('deletes a draft', async () => {
        const kit = await SourcingKit.create();
        const draft = await kit.draft();
        expect(codeOf(await kit.get(DeletePackageUseCase).execute({ actorId: USERS.owner, packageId: draft.id as never }))).toBe('ok');
        expect(await kit.packages.findById(draft.id as never)).toBeUndefined();
    });

    it('a sent package cannot be deleted (conflict)', async () => {
        const kit = await SourcingKit.create();
        const { pkg } = await kit.sentPackage();
        expect(codeOf(await kit.get(DeletePackageUseCase).execute({ actorId: USERS.owner, packageId: pkg.id as never }))).toBe('conflict');
    });

    describeBuyerAuthorization(['owner', 'admin', 'estimator'], k => k.draft(),
        (k, user, d) => k.get(DeletePackageUseCase).execute({ actorId: user, packageId: d.id as never }));
});
