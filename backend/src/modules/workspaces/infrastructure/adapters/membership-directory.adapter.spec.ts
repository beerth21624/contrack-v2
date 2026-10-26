import { WorkspacesTestKit } from '../../testing/workspaces-test-kit';
import { RepositoryMembershipDirectory } from './membership-directory.adapter';

describe('RepositoryMembershipDirectory', () => {
    it('lists the user\'s workspaces with name, kind and role, personal first then oldest first', async () => {
        const kit = new WorkspacesTestKit();
        const s = await kit.seedCompany();
        kit.clock.advance(1000);
        const other = await kit.seedWorkspace('company', [[s.admin, 'viewer']], 'Other Co');
        kit.clock.advance(1000);
        const personal = await kit.seedPersonal(s.admin, 'Adam (ส่วนตัว)');
        await kit.seedWorkspace('company', [[s.outsider, 'owner']], 'Not mine');

        const list = await new RepositoryMembershipDirectory(kit.memberships, kit.workspaces).listForUser(s.admin);
        expect(list).toEqual([
            { workspaceId: personal, name: 'Adam (ส่วนตัว)', kind: 'personal', role: 'owner' },
            { workspaceId: s.workspaceId, name: 'Acme Construction', kind: 'company', role: 'admin' },
            { workspaceId: other, name: 'Other Co', kind: 'company', role: 'viewer' },
        ]);
    });

    it('returns an empty list for a user without workspaces', async () => {
        const kit = new WorkspacesTestKit();
        const nobody = kit.addUser('Nobody');
        expect(await new RepositoryMembershipDirectory(kit.memberships, kit.workspaces).listForUser(nobody)).toEqual([]);
    });
});
