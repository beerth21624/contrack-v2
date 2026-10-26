import { ROLES_UNDER_TEST, WorkspacesTestKit } from '../../testing/workspaces-test-kit';
import { RepositoryWorkspaceAccess } from './workspace-access.adapter';

describe('RepositoryWorkspaceAccess', () => {
    it.each(ROLES_UNDER_TEST)('returns the role of a %s', async role => {
        const kit = new WorkspacesTestKit();
        const s = await kit.seedCompany();
        expect(await new RepositoryWorkspaceAccess(kit.memberships).roleOf(s.byRole[role], s.workspaceId)).toBe(role);
    });

    it('returns undefined for a non-member', async () => {
        const kit = new WorkspacesTestKit();
        const s = await kit.seedCompany();
        expect(await new RepositoryWorkspaceAccess(kit.memberships).roleOf(s.outsider, s.workspaceId)).toBeUndefined();
    });
});
