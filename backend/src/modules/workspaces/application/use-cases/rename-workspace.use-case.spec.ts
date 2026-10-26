import { WorkspacesTestKit, outcome, valueOf } from '../../testing/workspaces-test-kit';
import { RenameWorkspaceUseCase } from './rename-workspace.use-case';

describe('RenameWorkspaceUseCase', () => {
    let kit: WorkspacesTestKit;
    let useCase: RenameWorkspaceUseCase;

    beforeEach(() => {
        kit = new WorkspacesTestKit();
        useCase = new RenameWorkspaceUseCase(kit.workspaces, kit.memberships);
    });

    it.each(['owner', 'admin'] as const)('a %s renames the workspace', async role => {
        const s = await kit.seedCompany();
        const view = valueOf(await useCase.execute({ actorId: s.byRole[role], workspaceId: s.workspaceId, name: ' Acme Group ' }));
        expect(view.workspace.name.value).toBe('Acme Group');
        expect(view.role).toBe(role);
        expect(view.memberCount).toBe(4);
        expect((await kit.workspaces.findById(s.workspaceId))?.name.value).toBe('Acme Group');
    });

    it.each(['estimator', 'viewer'] as const)('a %s is forbidden', async role => {
        const s = await kit.seedCompany();
        expect(outcome(await useCase.execute({ actorId: s.byRole[role], workspaceId: s.workspaceId, name: 'X' }))).toBe('forbidden');
        expect((await kit.workspaces.findById(s.workspaceId))?.name.value).toBe('Acme Construction');
    });

    it('a non-member gets not_found', async () => {
        const s = await kit.seedCompany();
        expect(outcome(await useCase.execute({ actorId: s.outsider, workspaceId: s.workspaceId, name: 'X' }))).toBe('not_found');
    });

    it('rejects an invalid name', async () => {
        const s = await kit.seedCompany();
        expect(outcome(await useCase.execute({ actorId: s.owner, workspaceId: s.workspaceId, name: '  ' }))).toBe('validation_failed');
    });

    it('checks permission before validating the name (a viewer learns nothing about the rules)', async () => {
        const s = await kit.seedCompany();
        expect(outcome(await useCase.execute({ actorId: s.viewer, workspaceId: s.workspaceId, name: '' }))).toBe('forbidden');
    });

    it('the owner may rename their personal workspace', async () => {
        const me = kit.addUser('Somchai');
        const personal = await kit.seedPersonal(me);
        const view = valueOf(await useCase.execute({ actorId: me, workspaceId: personal, name: 'My space' }));
        expect(view.workspace.name.value).toBe('My space');
        expect(view.workspace.kind).toBe('personal');
    });
});
