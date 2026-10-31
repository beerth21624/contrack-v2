import { asProjectId, asUserId, asWorkspaceId } from '../domain/ids';
import { FakeModuleFlags, FakeProjectStatuses, FakeRoles, FakeWorkspaceDirectory } from '../testing/platform-fakes';
import { ModuleAccess } from './module-access';

const WS = asWorkspaceId('00000000-0000-4000-b000-000000000001');
const OTHER_WS = asWorkspaceId('00000000-0000-4000-b000-000000000002');
const OWNER = asUserId('00000000-0000-4000-a000-000000000001');
const VIEWER = asUserId('00000000-0000-4000-a000-000000000002');
const STRANGER = asUserId('00000000-0000-4000-a000-000000000003');
const PROJECT = asProjectId('00000000-0000-4000-c000-000000000001');
const ARCHIVED = asProjectId('00000000-0000-4000-c000-000000000002');

describe('ModuleAccess', () => {
    let flags: FakeModuleFlags;
    let access: ModuleAccess;

    beforeEach(() => {
        const roles = new FakeRoles();
        roles.set(OWNER, WS, 'owner');
        roles.set(VIEWER, WS, 'viewer');
        roles.set(STRANGER, OTHER_WS, 'owner');
        const projects = new FakeProjectStatuses();
        projects.set(PROJECT, { workspaceId: WS, archived: false });
        projects.set(ARCHIVED, { workspaceId: WS, archived: true });
        const members = new FakeWorkspaceDirectory();
        members.addMember(WS, OWNER, 'owner');
        members.addMember(WS, VIEWER, 'viewer');
        flags = new FakeModuleFlags();
        access = new ModuleAccess(roles, projects, flags, members);
    });

    const code = (r: { ok: boolean; error?: { code: string } }): string => (r.ok ? 'ok' : r.error?.code ?? '?');

    it('inWorkspace: not_found before module_disabled before forbidden', async () => {
        flags.set(WS, 'quotations', false);
        expect(code(await access.inWorkspace(STRANGER, WS, 'quotations', 'projects.edit'))).toBe('not_found');
        expect(code(await access.inWorkspace(VIEWER, WS, 'quotations', 'projects.edit'))).toBe('module_disabled');
        flags.set(WS, 'quotations', true);
        expect(code(await access.inWorkspace(VIEWER, WS, 'quotations', 'projects.edit'))).toBe('forbidden');
        const ok = await access.inWorkspace(OWNER, WS, 'quotations', 'projects.edit', 'workspace.read');
        expect(ok).toEqual({ ok: true, value: { workspaceId: WS, role: 'owner', memberCount: 2 } });
    });

    it('toProject: not_found (no project / not a member) → module_disabled → forbidden → project_archived on write', async () => {
        expect(code(await access.toProject(OWNER, asProjectId('00000000-0000-4000-c000-0000000000ff'), 'contracts', { permissions: [], write: false })))
            .toBe('not_found');
        flags.set(WS, 'contracts', false);
        expect(code(await access.toProject(STRANGER, PROJECT, 'contracts', { permissions: ['projects.edit'], write: true }))).toBe('not_found');
        expect(code(await access.toProject(VIEWER, ARCHIVED, 'contracts', { permissions: ['projects.edit'], write: true }))).toBe('module_disabled');
        flags.set(WS, 'contracts', true);
        expect(code(await access.toProject(VIEWER, ARCHIVED, 'contracts', { permissions: ['projects.edit'], write: true }))).toBe('forbidden');
        const archived = await access.toProject(OWNER, ARCHIVED, 'contracts', { permissions: ['projects.edit'], write: true });
        expect(archived).toMatchObject({ ok: false, error: { code: 'conflict', details: { reason: 'project_archived' } } });
        expect(await access.toProject(VIEWER, ARCHIVED, 'contracts', { permissions: ['projects.read'], write: false })).toEqual({
            ok: true, value: { workspaceId: WS, role: 'viewer', memberCount: 2, projectId: ARCHIVED, archived: true },
        });
    });
});
