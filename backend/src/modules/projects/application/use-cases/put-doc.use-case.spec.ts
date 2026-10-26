import { MAX_DOC_BYTES, type Role, type VersionConflictDetails } from '@contrack/contract';
import { docsToProject, projectSummary, stableStringify } from '@contrack/domain/sync';
import type { ProjectId, UserId } from '../../../../shared/domain';
import {
    BREAKING_DOC, OUTSIDER, OWNER, OWNER_B, ROLE_USERS, SAMPLE_DOCS, WS_A, WS_B, type ProjectsKit, projectsKit,
} from '../../testing/projects-test-kit';

async function put(
    kit: ProjectsKit, projectId: ProjectId, docKey: string, data: unknown, baseVersion: number, userId: UserId = OWNER,
) {
    return kit.putDoc.execute({ userId, projectId, docKey, data, baseVersion });
}

/** The summary the shared engine gives for the documents now stored. */
async function expectedSummary(kit: ProjectsKit, projectId: ProjectId, start: 'blank' | 'sample' = 'sample') {
    const docs = await kit.docs.listByProject(WS_A, projectId);
    return projectSummary(docsToProject(start, docs.map(d => d.toEntry())));
}

describe('PutDocUseCase', () => {
    describe('writes', () => {
        it('first write with baseVersion 0 creates version 1', async () => {
            const kit = projectsKit();
            const p = await kit.seedProject();
            const r = await put(kit, p.id, 'calc:fill', SAMPLE_DOCS.fill.data, 0);
            if (!r.ok) throw new Error(r.error.message);
            expect(r.value.doc.version).toBe(1);
            expect(r.value.doc.updatedBy).toBe(OWNER);
            const stored = await kit.docs.find(WS_A, p.id, 'calc:fill');
            expect(stored?.version).toBe(1);
            expect(stored?.data).toEqual(SAMPLE_DOCS.fill.data);
        });

        it('an update with the right base increases the version by 1', async () => {
            const kit = projectsKit();
            const p = await kit.seedProject();
            await put(kit, p.id, 'calc:fill', { width: 1 }, 0);
            const r = await put(kit, p.id, 'calc:fill', { width: 2 }, 1);
            expect(r.ok && r.value.doc.version).toBe(2);
            expect((await kit.docs.find(WS_A, p.id, 'calc:fill'))?.data).toEqual({ width: 2 });
        });

        it('reset to null keeps the row and still increases the version; activity says doc.reset', async () => {
            const kit = projectsKit();
            const p = await kit.seedProject();
            await put(kit, p.id, 'boq:R13', { mat: 350 }, 0);
            const r = await put(kit, p.id, 'boq:R13', null, 1);
            expect(r.ok && r.value.doc.version).toBe(2);
            const stored = await kit.docs.find(WS_A, p.id, 'boq:R13');
            expect(stored?.data).toBeNull();
            expect(stored?.version).toBe(2);
            const again = await put(kit, p.id, 'boq:R13', { mat: 1 }, 2);
            expect(again.ok && again.value.doc.version).toBe(3);
            const actions = (await kit.activity.list(WS_A, p.id, { limit: 10 })).map(a => [a.action, a.docKey]);
            expect(actions.slice(0, 3)).toEqual([['doc.updated', 'boq:R13'], ['doc.reset', 'boq:R13'], ['doc.updated', 'boq:R13']]);
        });

        it('the summary is the shared engine\'s result for the stored documents after every write', async () => {
            const kit = projectsKit();
            const p = await kit.seedProject();
            const before = p.summary;
            const r = await put(kit, p.id, 'boq:R13', { mat: 350 }, 0);
            if (!r.ok) throw new Error(r.error.message);
            expect(stableStringify(r.value.project.summary)).not.toBe(stableStringify(before));
            expect(r.value.project.summary).toEqual(await expectedSummary(kit, p.id));
            expect((await kit.projects.findInWorkspace(WS_A, p.id))?.summary).toEqual(r.value.project.summary);

            const journey = await put(kit, p.id, 'journey', { 'project-info': 'done', footing: 'skipped' }, 0);
            expect(journey.ok && journey.value.project.summary.levelsDone).toBe(2);
            expect(journey.ok && journey.value.project.summary).toEqual(await expectedSummary(kit, p.id));

            const reset = await put(kit, p.id, 'boq:R13', null, 1);
            expect(reset.ok && reset.value.project.summary).toEqual(await expectedSummary(kit, p.id));
            expect(reset.ok && reset.value.project.updatedAt).toEqual(kit.clock.now());
        });

        it('writes to one document never touch the others', async () => {
            const kit = projectsKit();
            const p = await kit.seedProject({ docs: [SAMPLE_DOCS.fill] });
            await put(kit, p.id, 'boq:R13', { mat: 350 }, 0);
            const fill = await kit.docs.find(WS_A, p.id, 'calc:fill');
            expect(fill?.version).toBe(1);
            expect(fill?.data).toEqual(SAMPLE_DOCS.fill.data);
        });
    });

    describe('version conflicts', () => {
        it('a stale base returns version_conflict with the current doc and changes nothing', async () => {
            const kit = projectsKit();
            const p = await kit.seedProject();
            await put(kit, p.id, 'calc:fill', { width: 1 }, 0);
            await put(kit, p.id, 'calc:fill', { width: 2 }, 1, ROLE_USERS.estimator);
            kit.publisher.events.length = 0;

            const r = await put(kit, p.id, 'calc:fill', { width: 99 }, 1);
            expect(!r.ok && r.error.code).toBe('version_conflict');
            const details = (!r.ok ? r.error.details : undefined) as VersionConflictDetails;
            expect(details.current).toMatchObject({ docKey: 'calc:fill', data: { width: 2 }, version: 2, updatedBy: ROLE_USERS.estimator });
            expect(typeof details.current?.updatedAt).toBe('string');
            expect((await kit.docs.find(WS_A, p.id, 'calc:fill'))?.data).toEqual({ width: 2 });
            expect(kit.publisher.events).toEqual([]);
        });

        it('base 0 on an existing doc conflicts; base > 0 on a missing doc conflicts with current null', async () => {
            const kit = projectsKit();
            const p = await kit.seedProject();
            await put(kit, p.id, 'calc:fill', { width: 1 }, 0);
            const exists = await put(kit, p.id, 'calc:fill', { width: 5 }, 0);
            expect(!exists.ok && exists.error.code).toBe('version_conflict');
            expect(!exists.ok && (exists.error.details as VersionConflictDetails).current?.version).toBe(1);

            const missing = await put(kit, p.id, 'boq:R13', { mat: 1 }, 3);
            expect(!missing.ok && missing.error.details).toEqual({ current: null });
        });

        it('a base ahead of the server conflicts too', async () => {
            const kit = projectsKit();
            const p = await kit.seedProject();
            await put(kit, p.id, 'calc:fill', { width: 1 }, 0);
            const r = await put(kit, p.id, 'calc:fill', { width: 2 }, 5);
            expect(!r.ok && r.error.code).toBe('version_conflict');
        });

        it('two concurrent writers on the same base: exactly one wins, the summary matches the winner', async () => {
            const kit = projectsKit();
            const p = await kit.seedProject();
            const [a, b] = await Promise.all([
                put(kit, p.id, 'boq:R13', { mat: 100 }, 0),
                put(kit, p.id, 'boq:R13', { mat: 200 }, 0, ROLE_USERS.admin),
            ]);
            expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
            const loser = a.ok ? b : a;
            expect(!loser.ok && loser.error.code).toBe('version_conflict');
            expect((await kit.projects.findInWorkspace(WS_A, p.id))?.summary).toEqual(await expectedSummary(kit, p.id));
        });

        it('concurrent writes to different docs both land, and the summary includes both', async () => {
            const kit = projectsKit();
            const p = await kit.seedProject();
            const [a, b] = await Promise.all([
                put(kit, p.id, 'boq:R13', { mat: 350 }, 0),
                put(kit, p.id, 'calc:fill', SAMPLE_DOCS.fill.data, 0),
            ]);
            expect(a.ok && b.ok).toBe(true);
            const stored = await kit.projects.findInWorkspace(WS_A, p.id);
            expect(stored?.summary).toEqual(await expectedSummary(kit, p.id));
            expect((await kit.docs.listByProject(WS_A, p.id)).map(d => d.docKey).sort()).toEqual(['boq:R13', 'calc:fill']);
        });
    });

    describe('refused documents (unprocessable, nothing stored, nothing published)', () => {
        it.each([
            ['an unknown key', 'calc:nope', { a: 1 }],
            ['an unknown BOQ line', 'boq:R99999', { qty: 1 }],
            ['an oversize doc', 'calc:fill', { big: 'x'.repeat(MAX_DOC_BYTES) }],
            ['invalid data', 'boq:R13', { price: 3 }],
            ['a non-finite number', 'boq:R13', { qty: Number.POSITIVE_INFINITY }],
            ['missing data', 'calc:fill', undefined],
            ['a doc that breaks computing', BREAKING_DOC.docKey, BREAKING_DOC.data],
        ])('%s', async (_what, docKey, data) => {
            const kit = projectsKit();
            const p = await kit.seedProject();
            const r = await put(kit, p.id, docKey, data, 0);
            expect(!r.ok && r.error.code).toBe('unprocessable');
            expect(!r.ok && r.error.message.length).toBeGreaterThan(0);
            expect(await kit.docs.listByProject(WS_A, p.id)).toEqual([]);
            expect((await kit.projects.findInWorkspace(WS_A, p.id))?.summary).toEqual(p.summary);
            expect(kit.publisher.events).toEqual([]);
        });

        it('a negative baseVersion is a validation error', async () => {
            const kit = projectsKit();
            const p = await kit.seedProject();
            const r = await put(kit, p.id, 'calc:fill', { width: 1 }, -1);
            expect(!r.ok && r.error.code).toBe('validation_failed');
        });
    });

    describe('archived project', () => {
        it('→ conflict, nothing stored', async () => {
            const kit = projectsKit();
            const p = await kit.seedProject();
            await kit.renameOrArchive.execute({ userId: OWNER, projectId: p.id, archived: true });
            kit.publisher.events.length = 0;
            const r = await put(kit, p.id, 'calc:fill', { width: 1 }, 0);
            expect(!r.ok && r.error.code).toBe('conflict');
            expect(await kit.docs.listByProject(WS_A, p.id)).toEqual([]);
            expect(kit.publisher.events).toEqual([]);
        });
    });

    describe('realtime', () => {
        it('publishes doc.updated then project.updated, after the write is stored', async () => {
            const kit = projectsKit();
            const p = await kit.seedProject();
            const seenAtPublish: (number | undefined)[] = [];
            kit.publisher.onPublish = async () => {
                seenAtPublish.push((await kit.docs.find(WS_A, p.id, 'calc:fill'))?.version);
            };
            const r = await put(kit, p.id, 'calc:fill', { width: 1 }, 0);
            if (!r.ok) throw new Error(r.error.message);
            expect(seenAtPublish).toEqual([1, 1]);
            expect(kit.publisher.events.map(e => e.type)).toEqual(['doc.updated', 'project.updated']);
            const [docEvent, projectEvent] = kit.publisher.events;
            expect(docEvent?.type === 'doc.updated' && docEvent.event).toEqual({
                projectId: p.id,
                doc: { docKey: 'calc:fill', data: { width: 1 }, version: 1, updatedBy: OWNER, updatedAt: kit.clock.now().toISOString() },
            });
            expect(projectEvent?.type === 'project.updated' && projectEvent.event.project.summary).toEqual(r.value.project.summary);
        });

        it('a failing publisher does not turn a committed write into an error', async () => {
            const kit = projectsKit();
            const p = await kit.seedProject();
            kit.publisher.failing = true;
            const r = await put(kit, p.id, 'calc:fill', { width: 1 }, 0);
            expect(r.ok).toBe(true);
            expect((await kit.docs.find(WS_A, p.id, 'calc:fill'))?.version).toBe(1);
        });

        it('publishes nothing on a conflict', async () => {
            const kit = projectsKit();
            const p = await kit.seedProject();
            await put(kit, p.id, 'calc:fill', { width: 1 }, 0);
            kit.publisher.events.length = 0;
            await put(kit, p.id, 'calc:fill', { width: 2 }, 0);
            expect(kit.publisher.events).toEqual([]);
        });
    });

    describe('authorization', () => {
        it.each<[Role, boolean]>([['owner', true], ['admin', true], ['estimator', true], ['viewer', false]])(
            '%s may edit: %s',
            async (role, allowed) => {
                const kit = projectsKit();
                const p = await kit.seedProject();
                const r = await put(kit, p.id, 'calc:fill', { width: 1 }, 0, ROLE_USERS[role]);
                if (allowed) expect(r.ok).toBe(true);
                else {
                    expect(!r.ok && r.error.code).toBe('forbidden');
                    expect(await kit.docs.listByProject(WS_A, p.id)).toEqual([]);
                }
            },
        );

        it('a non-member → not_found', async () => {
            const kit = projectsKit();
            const p = await kit.seedProject();
            const r = await put(kit, p.id, 'calc:fill', { width: 1 }, 0, OUTSIDER);
            expect(!r.ok && r.error.code).toBe('not_found');
        });

        it('cross-tenant: an owner of B can neither write A\'s project nor learn it exists', async () => {
            const kit = projectsKit();
            const p = await kit.seedProject();
            const r = await put(kit, p.id, 'calc:fill', { width: 1 }, 0, OWNER_B);
            expect(!r.ok && r.error.code).toBe('not_found');
            // Even an invalid key gets not_found (authorization first, no oracle).
            const bad = await put(kit, p.id, 'calc:nope', {}, 0, OWNER_B);
            expect(!bad.ok && bad.error.code).toBe('not_found');
            expect(await kit.docs.listByProject(WS_A, p.id)).toEqual([]);

            const theirs = await kit.seedProject({ by: OWNER_B, workspaceId: WS_B });
            const reverse = await put(kit, theirs.id, 'calc:fill', { width: 1 }, 0, OWNER);
            expect(!reverse.ok && reverse.error.code).toBe('not_found');
            expect(await kit.docs.listByProject(WS_B, theirs.id)).toEqual([]);
        });
    });
});
