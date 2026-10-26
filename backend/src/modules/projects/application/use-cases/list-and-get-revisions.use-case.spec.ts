// ListRevisionsUseCase and GetRevisionUseCase.
import { ROLES } from '@contrack/contract';
import { asRevisionId } from '../../../../shared/domain';
import { OUTSIDER, OWNER, OWNER_B, ROLE_USERS, WS_B, projectsKit } from '../../testing/projects-test-kit';

describe('ListRevisionsUseCase', () => {
    it('lists the project\'s revisions newest first', async () => {
        const kit = projectsKit();
        const p = await kit.seedProject();
        await kit.createRevision.execute({ userId: OWNER, projectId: p.id, label: 'R1' });
        kit.clock.advance(1000);
        await kit.createRevision.execute({ userId: OWNER, projectId: p.id, label: 'R2' });
        const r = await kit.listRevisions.execute({ userId: OWNER, projectId: p.id });
        expect(r.ok && r.value.map(x => x.label)).toEqual(['R2', 'R1']);
    });

    it.each(ROLES)('%s may list', async role => {
        const kit = projectsKit();
        const p = await kit.seedProject();
        expect((await kit.listRevisions.execute({ userId: ROLE_USERS[role], projectId: p.id })).ok).toBe(true);
    });

    it('a non-member or another tenant → not_found', async () => {
        const kit = projectsKit();
        const p = await kit.seedProject();
        const outsider = await kit.listRevisions.execute({ userId: OUTSIDER, projectId: p.id });
        expect(!outsider.ok && outsider.error.code).toBe('not_found');
        const cross = await kit.listRevisions.execute({ userId: OWNER_B, projectId: p.id });
        expect(!cross.ok && cross.error.code).toBe('not_found');
    });
});

describe('GetRevisionUseCase', () => {
    it('returns the revision with its snapshot', async () => {
        const kit = projectsKit();
        const p = await kit.seedProject();
        const created = await kit.createRevision.execute({ userId: OWNER, projectId: p.id, label: 'R1' });
        if (!created.ok) throw new Error(created.error.message);
        const r = await kit.getRevision.execute({ userId: ROLE_USERS.viewer, projectId: p.id, revisionId: created.value.id });
        expect(r.ok && r.value.label).toBe('R1');
        expect(r.ok && r.value.snapshot.schemaVersion).toBe(1);
    });

    it('an unknown revision, or one of another project, → not_found', async () => {
        const kit = projectsKit();
        const a = await kit.seedProject({ name: 'A' });
        const b = await kit.seedProject({ name: 'B' });
        const ofB = await kit.createRevision.execute({ userId: OWNER, projectId: b.id, label: 'R1' });
        if (!ofB.ok) throw new Error(ofB.error.message);
        const wrongProject = await kit.getRevision.execute({ userId: OWNER, projectId: a.id, revisionId: ofB.value.id });
        expect(!wrongProject.ok && wrongProject.error.code).toBe('not_found');
        const unknown = await kit.getRevision.execute({
            userId: OWNER, projectId: a.id, revisionId: asRevisionId('99999999-0000-4000-8000-000000000000'),
        });
        expect(!unknown.ok && unknown.error.code).toBe('not_found');
    });

    it('another tenant → not_found', async () => {
        const kit = projectsKit();
        const theirs = await kit.seedProject({ by: OWNER_B, workspaceId: WS_B });
        const rev = await kit.createRevision.execute({ userId: OWNER_B, projectId: theirs.id, label: 'R1' });
        if (!rev.ok) throw new Error(rev.error.message);
        const r = await kit.getRevision.execute({ userId: OWNER, projectId: theirs.id, revisionId: rev.value.id });
        expect(!r.ok && r.error.code).toBe('not_found');
        const outsider = await kit.getRevision.execute({ userId: OUTSIDER, projectId: theirs.id, revisionId: rev.value.id });
        expect(!outsider.ok && outsider.error.code).toBe('not_found');
    });
});
