import type { Role } from '@contrack/contract';
import { computeProject } from '@contrack/domain/project';
import { docsToProject, projectSummary, stableStringify } from '@contrack/domain/sync';
import {
    OUTSIDER, OWNER, OWNER_B, ROLE_USERS, SAMPLE_DOCS, WS_A, WS_B, projectsKit,
} from '../../testing/projects-test-kit';

describe('CreateRevisionUseCase', () => {
    it('snapshots the assembled project with totals equal to the project summary', async () => {
        const kit = projectsKit();
        const p = await kit.seedProject({ docs: [SAMPLE_DOCS.meta, SAMPLE_DOCS.fill, SAMPLE_DOCS.journey] });
        const put = await kit.putDoc.execute({ userId: OWNER, projectId: p.id, docKey: 'boq:R13', data: { mat: 350 }, baseVersion: 0 });
        if (!put.ok) throw new Error(put.error.message);

        const r = await kit.createRevision.execute({ userId: OWNER, projectId: p.id, label: ' Rev 01 ', note: ' ส่งลูกค้า ' });
        if (!r.ok) throw new Error(r.error.message);
        expect(r.value.label).toBe('Rev 01');
        expect(r.value.note).toBe('ส่งลูกค้า');
        expect(r.value.createdBy).toBe(OWNER);
        expect(r.value.totals).toEqual(put.value.project.summary);

        const docs = await kit.docs.listByProject(WS_A, p.id);
        const assembled = docsToProject('sample', docs.map(d => d.toEntry()));
        expect(stableStringify(r.value.snapshot)).toBe(stableStringify(assembled));
    });

    it('the stored snapshot recomputes to exactly the stored totals', async () => {
        const kit = projectsKit();
        const p = await kit.seedProject({ start: 'blank', docs: [SAMPLE_DOCS.fill, SAMPLE_DOCS.r13] });
        const r = await kit.createRevision.execute({ userId: OWNER, projectId: p.id, label: 'R1' });
        if (!r.ok) throw new Error(r.error.message);
        const stored = await kit.revisions.find(WS_A, p.id, r.value.id);
        if (stored === undefined) throw new Error('not stored');
        expect(projectSummary(stored.snapshot)).toEqual(stored.totals);
        expect(computeProject(stored.snapshot).boq.constructionTotal).toBe(stored.totals.constructionTotal);
    });

    it('later edits never change a revision', async () => {
        const kit = projectsKit();
        const p = await kit.seedProject();
        const r = await kit.createRevision.execute({ userId: OWNER, projectId: p.id, label: 'R1' });
        if (!r.ok) throw new Error(r.error.message);
        await kit.putDoc.execute({ userId: OWNER, projectId: p.id, docKey: 'boq:R13', data: { mat: 350 }, baseVersion: 0 });
        const stored = await kit.revisions.find(WS_A, p.id, r.value.id);
        expect(stored?.totals).toEqual(p.summary);
        expect(stored?.snapshot.boqOverrides).toEqual({});
    });

    it('a label is unique per project (conflict), but may repeat in another project', async () => {
        const kit = projectsKit();
        const a = await kit.seedProject({ name: 'A' });
        const b = await kit.seedProject({ name: 'B' });
        expect((await kit.createRevision.execute({ userId: OWNER, projectId: a.id, label: 'Rev 01' })).ok).toBe(true);
        const again = await kit.createRevision.execute({ userId: OWNER, projectId: a.id, label: 'Rev 01' });
        expect(!again.ok && again.error.code).toBe('conflict');
        expect((await kit.createRevision.execute({ userId: OWNER, projectId: b.id, label: 'Rev 01' })).ok).toBe(true);
        expect(await kit.revisions.listByProject(WS_A, a.id)).toHaveLength(1);
    });

    it('records revision.created', async () => {
        const kit = projectsKit();
        const p = await kit.seedProject();
        await kit.createRevision.execute({ userId: ROLE_USERS.estimator, projectId: p.id, label: 'R1' });
        const [latest] = await kit.activity.list(WS_A, p.id, { limit: 1 });
        expect(latest?.action).toBe('revision.created');
        expect(latest?.userId).toBe(ROLE_USERS.estimator);
    });

    it('refuses an empty or too long label', async () => {
        const kit = projectsKit();
        const p = await kit.seedProject();
        const empty = await kit.createRevision.execute({ userId: OWNER, projectId: p.id, label: ' ' });
        expect(!empty.ok && empty.error.code).toBe('validation_failed');
        const long = await kit.createRevision.execute({ userId: OWNER, projectId: p.id, label: 'x'.repeat(41) });
        expect(!long.ok && long.error.code).toBe('validation_failed');
    });

    it.each<[Role, boolean]>([['owner', true], ['admin', true], ['estimator', true], ['viewer', false]])(
        '%s may create a revision: %s',
        async (role, allowed) => {
            const kit = projectsKit();
            const p = await kit.seedProject();
            const r = await kit.createRevision.execute({ userId: ROLE_USERS[role], projectId: p.id, label: 'R1' });
            if (allowed) expect(r.ok).toBe(true);
            else expect(!r.ok && r.error.code).toBe('forbidden');
        },
    );

    it('a non-member or another tenant → not_found', async () => {
        const kit = projectsKit();
        const p = await kit.seedProject();
        const outsider = await kit.createRevision.execute({ userId: OUTSIDER, projectId: p.id, label: 'R1' });
        expect(!outsider.ok && outsider.error.code).toBe('not_found');
        const cross = await kit.createRevision.execute({ userId: OWNER_B, projectId: p.id, label: 'R1' });
        expect(!cross.ok && cross.error.code).toBe('not_found');
        const theirs = await kit.seedProject({ by: OWNER_B, workspaceId: WS_B });
        const reverse = await kit.createRevision.execute({ userId: OWNER, projectId: theirs.id, label: 'R1' });
        expect(!reverse.ok && reverse.error.code).toBe('not_found');
        expect(await kit.revisions.listByProject(WS_A, p.id)).toEqual([]);
    });
});
