import { WorkspacesTestKit, outcome, valueOf } from '../../testing/workspaces-test-kit';
import { CreateCompanyWorkspaceUseCase } from './create-company-workspace.use-case';

describe('CreateCompanyWorkspaceUseCase', () => {
    let kit: WorkspacesTestKit;
    let useCase: CreateCompanyWorkspaceUseCase;

    beforeEach(() => {
        kit = new WorkspacesTestKit();
        useCase = new CreateCompanyWorkspaceUseCase(kit.workspaces, kit.memberships, kit.uow, kit.clock, kit.ids);
    });

    it('creates a company workspace with the caller as its only owner', async () => {
        const me = kit.addUser('Somchai');
        const view = valueOf(await useCase.execute({ actorId: me, name: '  Acme Construction  ' }));

        expect(view.role).toBe('owner');
        expect(view.memberCount).toBe(1);
        expect(view.workspace.kind).toBe('company');
        expect(view.workspace.name.value).toBe('Acme Construction');
        expect(view.workspace.createdAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');

        const stored = await kit.workspaces.findById(view.workspace.id);
        expect(stored?.name.value).toBe('Acme Construction');
        expect(await kit.roleOf(view.workspace.id, me)).toBe('owner');
        expect(await kit.memberships.listByWorkspace(view.workspace.id)).toHaveLength(1);
    });

    it('writes the workspace and the owner in one unit of work', async () => {
        const run = jest.spyOn(kit.uow, 'run');
        valueOf(await useCase.execute({ actorId: kit.addUser('Somchai'), name: 'Acme' }));
        expect(run).toHaveBeenCalledTimes(1);
    });

    it('lets a user own several company workspaces next to their personal one', async () => {
        const me = kit.addUser('Somchai');
        await kit.seedPersonal(me);
        const a = valueOf(await useCase.execute({ actorId: me, name: 'A' }));
        const b = valueOf(await useCase.execute({ actorId: me, name: 'B' }));
        expect(a.workspace.id).not.toBe(b.workspace.id);
        expect(await kit.memberships.listByUser(me)).toHaveLength(3);
    });

    it.each(['', '   ', 'x'.repeat(121)])('rejects an invalid name (%j) and stores nothing', async name => {
        const me = kit.addUser('Somchai');
        expect(outcome(await useCase.execute({ actorId: me, name }))).toBe('validation_failed');
        expect(await kit.memberships.listByUser(me)).toHaveLength(0);
    });
});
