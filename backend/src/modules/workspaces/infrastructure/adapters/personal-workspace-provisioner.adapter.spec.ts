import { ProvisionPersonalWorkspaceUseCase } from '../../application/use-cases/provision-personal-workspace.use-case';
import { WorkspacesTestKit } from '../../testing/workspaces-test-kit';
import { UseCasePersonalWorkspaceProvisioner } from './personal-workspace-provisioner.adapter';

describe('UseCasePersonalWorkspaceProvisioner', () => {
    it('returns the id of the new personal workspace owned by the user', async () => {
        const kit = new WorkspacesTestKit();
        const provisioner = new UseCasePersonalWorkspaceProvisioner(
            new ProvisionPersonalWorkspaceUseCase(kit.workspaces, kit.memberships, kit.uow, kit.clock, kit.ids));
        const me = kit.addUser('Somchai');

        const id = await provisioner.provision(me, 'Somchai');

        expect((await kit.workspaces.findById(id))?.name.value).toBe('Somchai (ส่วนตัว)');
        expect(await kit.roleOf(id, me)).toBe('owner');
    });
});
