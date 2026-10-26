import { WORKSPACE_NAME_MAX_LENGTH } from '../../domain/value-objects/workspace-name.value-object';
import { WorkspacesTestKit, valueOf } from '../../testing/workspaces-test-kit';
import { PERSONAL_SUFFIX, ProvisionPersonalWorkspaceUseCase, personalWorkspaceName } from './provision-personal-workspace.use-case';

describe('personalWorkspaceName', () => {
    it('appends the personal suffix to the display name', () => {
        expect(personalWorkspaceName('  Somchai  ')).toBe('Somchai (ส่วนตัว)');
    });

    it('always fits a workspace name', () => {
        const name = personalWorkspaceName('ก'.repeat(500));
        expect(name.length).toBeLessThanOrEqual(WORKSPACE_NAME_MAX_LENGTH);
        expect(name.endsWith(PERSONAL_SUFFIX)).toBe(true);
    });

    it('falls back when the display name is blank', () => {
        expect(personalWorkspaceName('   ').endsWith(PERSONAL_SUFFIX)).toBe(true);
        expect(personalWorkspaceName('   ').trim().length).toBeGreaterThan(PERSONAL_SUFFIX.trim().length);
    });
});

describe('ProvisionPersonalWorkspaceUseCase', () => {
    let kit: WorkspacesTestKit;
    let useCase: ProvisionPersonalWorkspaceUseCase;

    beforeEach(() => {
        kit = new WorkspacesTestKit();
        useCase = new ProvisionPersonalWorkspaceUseCase(kit.workspaces, kit.memberships, kit.uow, kit.clock, kit.ids);
    });

    it('creates a personal workspace with the user as its only owner', async () => {
        const me = kit.addUser('Somchai');
        const workspace = valueOf(await useCase.execute({ userId: me, displayName: 'Somchai' }));

        expect(workspace.kind).toBe('personal');
        expect(workspace.name.value).toBe('Somchai (ส่วนตัว)');
        expect(workspace.createdAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
        expect((await kit.workspaces.findById(workspace.id))?.kind).toBe('personal');
        const members = await kit.memberships.listByWorkspace(workspace.id);
        expect(members.map(m => [m.userId, m.role])).toEqual([[me, 'owner']]);
    });

    it('writes inside a unit of work (joins the caller\'s registration transaction)', async () => {
        const run = jest.spyOn(kit.uow, 'run');
        valueOf(await useCase.execute({ userId: kit.addUser('Somchai'), displayName: 'Somchai' }));
        expect(run).toHaveBeenCalledTimes(1);
    });
});
