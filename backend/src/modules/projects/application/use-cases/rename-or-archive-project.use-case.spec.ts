import type { Role } from '@contrack/contract';
import type { ProjectId } from '../../../../shared/domain';
import {
    OUTSIDER, OWNER, OWNER_B, ROLE_USERS, WS_A, WS_B, type ProjectsKit, projectsKit,
} from '../../testing/projects-test-kit';

const actions = async (kit: ProjectsKit, projectId: ProjectId): Promise<string[]> =>
    (await kit.activity.list(WS_A, projectId, { limit: 50 })).map(a => a.action);

describe('RenameOrArchiveProjectUseCase', () => {
    it('renames, records project.renamed and publishes project.updated after commit', async () => {
        const kit = projectsKit();
        const p = await kit.seedProject({ name: 'Old' });
        kit.clock.advance(60_000);
        const r = await kit.renameOrArchive.execute({ userId: OWNER, projectId: p.id, name: ' New ' });
        if (!r.ok) throw new Error(r.error.message);
        expect(r.value.name.value).toBe('New');
        expect(r.value.updatedAt).toEqual(kit.clock.now());
        expect((await kit.projects.findInWorkspace(WS_A, p.id))?.name.value).toBe('New');
        expect(await actions(kit, p.id)).toEqual(['project.renamed', 'project.created']);
        expect(kit.publisher.events.map(e => e.type)).toEqual(['project.updated']);
    });

    it('archives and restores', async () => {
        const kit = projectsKit();
        const p = await kit.seedProject();
        const archived = await kit.renameOrArchive.execute({ userId: OWNER, projectId: p.id, archived: true });
        expect(archived.ok && archived.value.isArchived).toBe(true);
        const restored = await kit.renameOrArchive.execute({ userId: OWNER, projectId: p.id, archived: false });
        expect(restored.ok && restored.value.isArchived).toBe(false);
        expect(await actions(kit, p.id)).toEqual(['project.restored', 'project.archived', 'project.created']);
    });

    it('a no-op change writes no activity and publishes nothing', async () => {
        const kit = projectsKit();
        const p = await kit.seedProject({ name: 'Same' });
        const r = await kit.renameOrArchive.execute({ userId: OWNER, projectId: p.id, name: 'Same', archived: false });
        expect(r.ok).toBe(true);
        expect(await actions(kit, p.id)).toEqual(['project.created']);
        expect(kit.publisher.events).toEqual([]);
    });

    it('an archived project cannot be renamed unless restored in the same request', async () => {
        const kit = projectsKit();
        const p = await kit.seedProject({ name: 'Old' });
        await kit.renameOrArchive.execute({ userId: OWNER, projectId: p.id, archived: true });
        const rename = await kit.renameOrArchive.execute({ userId: OWNER, projectId: p.id, name: 'New' });
        expect(!rename.ok && rename.error.code).toBe('conflict');
        const both = await kit.renameOrArchive.execute({ userId: OWNER, projectId: p.id, name: 'New', archived: false });
        expect(both.ok && both.value.name.value).toBe('New');
    });

    it('keeps the summary written by a document change (never overwrites it with an old copy)', async () => {
        const kit = projectsKit();
        const p = await kit.seedProject();
        const put = await kit.putDoc.execute({ userId: OWNER, projectId: p.id, docKey: 'boq:R13', data: { mat: 350 }, baseVersion: 0 });
        if (!put.ok) throw new Error(put.error.message);
        const r = await kit.renameOrArchive.execute({ userId: OWNER, projectId: p.id, name: 'Renamed' });
        expect(r.ok && r.value.summary).toEqual(put.value.project.summary);
    });

    it('refuses an empty name and an empty request', async () => {
        const kit = projectsKit();
        const p = await kit.seedProject();
        const empty = await kit.renameOrArchive.execute({ userId: OWNER, projectId: p.id, name: '  ' });
        expect(!empty.ok && empty.error.code).toBe('validation_failed');
        const nothing = await kit.renameOrArchive.execute({ userId: OWNER, projectId: p.id });
        expect(!nothing.ok && nothing.error.code).toBe('validation_failed');
    });

    it.each<[Role, boolean]>([['owner', true], ['admin', true], ['estimator', true], ['viewer', false]])(
        '%s may rename: %s',
        async (role, allowed) => {
            const kit = projectsKit();
            const p = await kit.seedProject();
            const r = await kit.renameOrArchive.execute({ userId: ROLE_USERS[role], projectId: p.id, name: 'New' });
            if (allowed) expect(r.ok).toBe(true);
            else expect(!r.ok && r.error.code).toBe('forbidden');
        },
    );

    it.each<[Role, boolean]>([['owner', true], ['admin', true], ['estimator', true], ['viewer', false]])(
        '%s may archive: %s',
        async (role, allowed) => {
            const kit = projectsKit();
            const p = await kit.seedProject();
            const r = await kit.renameOrArchive.execute({ userId: ROLE_USERS[role], projectId: p.id, archived: true });
            if (allowed) expect(r.ok).toBe(true);
            else expect(!r.ok && r.error.code).toBe('forbidden');
        },
    );

    it('a non-member or another tenant → not_found, nothing changes', async () => {
        const kit = projectsKit();
        const p = await kit.seedProject({ name: 'Mine' });
        const outsider = await kit.renameOrArchive.execute({ userId: OUTSIDER, projectId: p.id, name: 'Hacked' });
        expect(!outsider.ok && outsider.error.code).toBe('not_found');
        const cross = await kit.renameOrArchive.execute({ userId: OWNER_B, projectId: p.id, archived: true });
        expect(!cross.ok && cross.error.code).toBe('not_found');
        const stored = await kit.projects.findInWorkspace(WS_A, p.id);
        expect(stored?.name.value).toBe('Mine');
        expect(stored?.isArchived).toBe(false);
        const theirs = await kit.seedProject({ by: OWNER_B, workspaceId: WS_B });
        const reverse = await kit.renameOrArchive.execute({ userId: OWNER, projectId: theirs.id, name: 'X' });
        expect(!reverse.ok && reverse.error.code).toBe('not_found');
    });
});
