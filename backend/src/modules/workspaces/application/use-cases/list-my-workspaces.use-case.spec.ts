import { WorkspacesTestKit, valueOf } from '../../testing/workspaces-test-kit';
import { ListMyWorkspacesUseCase } from './list-my-workspaces.use-case';

describe('ListMyWorkspacesUseCase', () => {
    let kit: WorkspacesTestKit;
    let useCase: ListMyWorkspacesUseCase;

    beforeEach(() => {
        kit = new WorkspacesTestKit();
        useCase = new ListMyWorkspacesUseCase(kit.workspaces, kit.memberships);
    });

    it('lists every workspace of the caller with role and member count, personal first', async () => {
        const s = await kit.seedCompany();
        kit.clock.advance(1000);
        const other = await kit.seedWorkspace('company', [[s.viewer, 'owner']], 'Viewer Co');
        kit.clock.advance(1000);
        const personal = await kit.seedPersonal(s.viewer, 'Victor (ส่วนตัว)');

        const views = valueOf(await useCase.execute({ actorId: s.viewer }));
        expect(views.map(v => [v.workspace.id, v.workspace.kind, v.role, v.memberCount])).toEqual([
            [personal, 'personal', 'owner', 1],
            [s.workspaceId, 'company', 'viewer', 4],
            [other, 'company', 'owner', 1],
        ]);
    });

    it.each(['owner', 'admin', 'estimator', 'viewer'] as const)('shows the %s their own role', async role => {
        const s = await kit.seedCompany();
        const [view] = valueOf(await useCase.execute({ actorId: s.byRole[role] }));
        expect(view?.role).toBe(role);
    });

    it('returns an empty list for a user without memberships', async () => {
        const s = await kit.seedCompany();
        expect(valueOf(await useCase.execute({ actorId: s.outsider }))).toEqual([]);
    });

    it('never lists another tenant', async () => {
        const s = await kit.seedCompany();
        await kit.seedWorkspace('company', [[s.outsider, 'owner']], 'Outsider Co');
        const ids = valueOf(await useCase.execute({ actorId: s.owner })).map(v => v.workspace.id);
        expect(ids).toEqual([s.workspaceId]);
    });
});
