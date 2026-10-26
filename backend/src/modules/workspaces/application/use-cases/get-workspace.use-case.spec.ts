import { asWorkspaceId } from '../../../../shared/domain/ids';
import { ROLES_UNDER_TEST, WorkspacesTestKit, outcome, valueOf } from '../../testing/workspaces-test-kit';
import { GetWorkspaceUseCase } from './get-workspace.use-case';

describe('GetWorkspaceUseCase', () => {
    let kit: WorkspacesTestKit;
    let useCase: GetWorkspaceUseCase;

    beforeEach(() => {
        kit = new WorkspacesTestKit();
        useCase = new GetWorkspaceUseCase(kit.workspaces, kit.memberships);
    });

    it.each(ROLES_UNDER_TEST)('a %s reads the workspace with their role and the member count', async role => {
        const s = await kit.seedCompany();
        const view = valueOf(await useCase.execute({ actorId: s.byRole[role], workspaceId: s.workspaceId }));
        expect(view.workspace.id).toBe(s.workspaceId);
        expect(view.workspace.name.value).toBe('Acme Construction');
        expect(view.role).toBe(role);
        expect(view.memberCount).toBe(4);
    });

    it('a non-member gets not_found', async () => {
        const s = await kit.seedCompany();
        expect(outcome(await useCase.execute({ actorId: s.outsider, workspaceId: s.workspaceId }))).toBe('not_found');
    });

    it('an unknown workspace is not_found', async () => {
        const s = await kit.seedCompany();
        const missing = asWorkspaceId('00000000-0000-4000-8000-00000000ffff');
        expect(outcome(await useCase.execute({ actorId: s.owner, workspaceId: missing }))).toBe('not_found');
    });

    it('reads a personal workspace', async () => {
        const me = kit.addUser('Somchai');
        const personal = await kit.seedPersonal(me);
        const view = valueOf(await useCase.execute({ actorId: me, workspaceId: personal }));
        expect(view.workspace.kind).toBe('personal');
        expect(view.memberCount).toBe(1);
    });
});
