import type { Role } from '@contrack/contract';
import { ProjectDependents } from '../../../../shared/application/ports';
import { asCrewAssignmentId, asProjectId } from '../../../../shared/domain';
import {
    OUTSIDER, OWNER, OWNER_B, P_A, P_A2, P_ARCHIVED, P_B, ROLE_USERS, WS_A, WS_B, workforceKit,
} from '../../testing/workforce-test-kit';

describe('crew assignment use cases', () => {
    describe('create', () => {
        it('puts a crew on a planned task; overlapping assignments of one crew are allowed', async () => {
            const kit = workforceKit();
            const crew = await kit.seedCrew();
            const r = await kit.createAssignment.execute({
                userId: ROLE_USERS.estimator, workspaceId: WS_A, projectId: P_A, taskId: '4.1', crewId: crew.id,
                start: '2026-03-05', end: '2026-03-20', note: ' ก่ออิฐชั้นล่าง ',
            });
            expect(r.ok && r.value.toProps()).toMatchObject({
                workspaceId: WS_A, projectId: P_A, taskId: '4.1', crewId: crew.id, start: '2026-03-05', end: '2026-03-20',
                note: 'ก่ออิฐชั้นล่าง', createdBy: ROLE_USERS.estimator,
            });
            const overlap = await kit.createAssignment.execute({
                userId: OWNER, workspaceId: WS_A, projectId: P_A2, taskId: '5.1', crewId: crew.id, start: '2026-03-10', end: '2026-03-25',
            });
            expect(overlap.ok).toBe(true);
            expect((await kit.assignments.list(WS_A, { crewId: crew.id })).length).toBe(2);
        });

        it.each<[Role, boolean]>([['owner', true], ['admin', true], ['estimator', true], ['viewer', false]])(
            '%s may assign: %s',
            async (role, allowed) => {
                const kit = workforceKit();
                const crew = await kit.seedCrew();
                const r = await kit.createAssignment.execute({
                    userId: ROLE_USERS[role], workspaceId: WS_A, projectId: P_A, taskId: '1.1', crewId: crew.id, start: '2026-03-01', end: '2026-03-02',
                });
                expect(r.ok ? 'ok' : r.error.code).toBe(allowed ? 'ok' : 'forbidden');
            },
        );

        it('project: of another workspace or unknown → not_found; archived → conflict', async () => {
            const kit = workforceKit();
            const crew = await kit.seedCrew();
            const base = { userId: OWNER, workspaceId: WS_A, taskId: '1.1', crewId: crew.id, start: '2026-03-01', end: '2026-03-02' };
            for (const projectId of [P_B, asProjectId('99999999-0000-4000-8000-000000000000')]) {
                const r = await kit.createAssignment.execute({ ...base, projectId });
                expect(!r.ok && r.error.code).toBe('not_found');
            }
            const archived = await kit.createAssignment.execute({ ...base, projectId: P_ARCHIVED });
            expect(!archived.ok && archived.error.code).toBe('conflict');
        });

        it('crew: archived or of another workspace → 422; bad task / days → validation', async () => {
            const kit = workforceKit();
            const archived = await kit.seedCrew();
            await kit.archiveCrew.execute({ userId: OWNER, workspaceId: WS_A, crewId: archived.id });
            const foreign = await kit.seedCrew({ by: OWNER_B, workspaceId: WS_B });
            const base = { userId: OWNER, workspaceId: WS_A, projectId: P_A, taskId: '1.1', start: '2026-03-01', end: '2026-03-02' };
            for (const crewId of [archived.id, foreign.id]) {
                const r = await kit.createAssignment.execute({ ...base, crewId });
                expect(!r.ok && r.error.code).toBe('unprocessable');
                expect(!r.ok && r.error.details).toEqual({ field: 'crewId', ids: [crewId] });
            }
            const crew = await kit.seedCrew();
            for (const bad of [{ taskId: '9' }, { start: '2026-03-03' }, { end: '2026-02-30' }]) {
                const r = await kit.createAssignment.execute({ ...base, crewId: crew.id, ...bad });
                expect(r.ok ? 'ok' : r.error.code).toBe('validation_failed');
            }
        });
    });

    describe('list', () => {
        it('filters by project, crew and overlapping days; ordered by start', async () => {
            const kit = workforceKit();
            const c1 = await kit.seedCrew();
            const c2 = await kit.seedCrew();
            const late = await kit.seedAssignment(c1.id, { start: '2026-04-01', end: '2026-04-10' });
            const early = await kit.seedAssignment(c1.id, { start: '2026-03-01', end: '2026-03-05', projectId: P_A2 });
            const mid = await kit.seedAssignment(c2.id, { start: '2026-03-04', end: '2026-03-20' });
            const ids = async (q: Record<string, string>) => {
                const r = await kit.listAssignments.execute({ userId: ROLE_USERS.viewer, workspaceId: WS_A, ...q });
                return r.ok ? r.value.map(a => a.id) : r.error.code;
            };
            expect(await ids({})).toEqual([early.id, mid.id, late.id]);
            expect(await ids({ projectId: P_A })).toEqual([mid.id, late.id]);
            expect(await ids({ crewId: c1.id })).toEqual([early.id, late.id]);
            expect(await ids({ from: '2026-03-05', to: '2026-03-05' })).toEqual([early.id, mid.id]);
            expect(await ids({ from: '2026-03-06' })).toEqual([mid.id, late.id]);
            expect(await ids({ to: '2026-03-03' })).toEqual([early.id]);
            expect(await ids({ from: '2026-03-21', to: '2026-03-31' })).toEqual([]);
            expect(await ids({ from: '2026-03-10', to: '2026-03-01' })).toBe('validation_failed');
            expect(await ids({ projectId: P_B })).toEqual([]);
        });

        it('a non-member gets not_found; another workspace sees none of them', async () => {
            const kit = workforceKit();
            await kit.seedAssignment((await kit.seedCrew()).id);
            const outsider = await kit.listAssignments.execute({ userId: OUTSIDER, workspaceId: WS_A });
            expect(!outsider.ok && outsider.error.code).toBe('not_found');
            const b = await kit.listAssignments.execute({ userId: OWNER_B, workspaceId: WS_B });
            expect(b.ok && b.value).toEqual([]);
        });
    });

    describe('update and delete', () => {
        it('moves days and crew; the merged range keeps start ≤ end', async () => {
            const kit = workforceKit();
            const c1 = await kit.seedCrew();
            const c2 = await kit.seedCrew();
            const a = await kit.seedAssignment(c1.id, { start: '2026-03-01', end: '2026-03-10' });
            kit.clock.advance(1000);
            const r = await kit.updateAssignment.execute({ userId: ROLE_USERS.estimator, workspaceId: WS_A, assignmentId: a.id, crewId: c2.id, end: '2026-03-15' });
            expect(r.ok && r.value.toProps()).toMatchObject({ crewId: c2.id, start: '2026-03-01', end: '2026-03-15' });
            expect(r.ok && r.value.updatedAt).toEqual(kit.clock.now());
            const backwards = await kit.updateAssignment.execute({ userId: OWNER, workspaceId: WS_A, assignmentId: a.id, start: '2026-03-16' });
            expect(!backwards.ok && backwards.error.code).toBe('validation_failed');
            const none = await kit.updateAssignment.execute({ userId: OWNER, workspaceId: WS_A, assignmentId: a.id });
            expect(!none.ok && none.error.code).toBe('validation_failed');
        });

        it('an assignment of an archived crew can only move to an active crew', async () => {
            const kit = workforceKit();
            const old = await kit.seedCrew();
            const a = await kit.seedAssignment(old.id, { start: '2026-01-01', end: '2026-01-31' });
            await kit.archiveCrew.execute({ userId: OWNER, workspaceId: WS_A, crewId: old.id });
            const stale = await kit.updateAssignment.execute({ userId: OWNER, workspaceId: WS_A, assignmentId: a.id, end: '2026-03-31' });
            expect(!stale.ok && stale.error.code).toBe('unprocessable');
            const fresh = await kit.seedCrew();
            expect((await kit.updateAssignment.execute({ userId: OWNER, workspaceId: WS_A, assignmentId: a.id, crewId: fresh.id })).ok).toBe(true);
        });

        it('unknown / other workspace → not_found; archived project → conflict; viewer → forbidden', async () => {
            const kit = workforceKit();
            const crew = await kit.seedCrew();
            const a = await kit.seedAssignment(crew.id);
            const foreign = await kit.seedAssignment((await kit.seedCrew({ by: OWNER_B, workspaceId: WS_B })).id, {
                by: OWNER_B, workspaceId: WS_B, projectId: P_B,
            });
            for (const assignmentId of [foreign.id, asCrewAssignmentId('99999999-0000-4000-8000-000000000000')]) {
                const u = await kit.updateAssignment.execute({ userId: OWNER, workspaceId: WS_A, assignmentId, note: 'x' });
                expect(!u.ok && u.error.code).toBe('not_found');
                const d = await kit.deleteAssignment.execute({ userId: OWNER, workspaceId: WS_A, assignmentId });
                expect(!d.ok && d.error.code).toBe('not_found');
            }
            const viewer = await kit.deleteAssignment.execute({ userId: ROLE_USERS.viewer, workspaceId: WS_A, assignmentId: a.id });
            expect(!viewer.ok && viewer.error.code).toBe('forbidden');
            kit.projects.rows.set(P_A, { workspaceId: WS_A, archived: true });
            const u = await kit.updateAssignment.execute({ userId: OWNER, workspaceId: WS_A, assignmentId: a.id, note: 'x' });
            expect(!u.ok && u.error.code).toBe('conflict');
            const d = await kit.deleteAssignment.execute({ userId: OWNER, workspaceId: WS_A, assignmentId: a.id });
            expect(!d.ok && d.error.code).toBe('conflict');
            kit.projects.rows.set(P_A, { workspaceId: WS_A, archived: false });
            expect((await kit.deleteAssignment.execute({ userId: OWNER, workspaceId: WS_A, assignmentId: a.id })).ok).toBe(true);
            expect(await kit.assignments.find(WS_A, a.id)).toBeUndefined();
        });
    });

    it('ProjectDependents: deleting a project removes its assignments and supervisors only', async () => {
        const kit = workforceKit();
        const dependents = new ProjectDependents();
        dependents.register(async (ws, p) => {
            await kit.assignments.deleteByProject(ws, p);
            await kit.supervisors.deleteByProject(ws, p);
        });
        const crew = await kit.seedCrew();
        const person = await kit.seedPerson();
        await kit.seedAssignment(crew.id, { projectId: P_A });
        const kept = await kit.seedAssignment(crew.id, { projectId: P_A2 });
        await kit.putSupervisors.execute({ userId: OWNER, projectId: P_A, personIds: [person.id] });
        await kit.putSupervisors.execute({ userId: OWNER, projectId: P_A2, personIds: [person.id] });
        await dependents.deleteByProject(WS_A, P_A);
        expect((await kit.assignments.list(WS_A, {})).map(a => a.id)).toEqual([kept.id]);
        expect(await kit.supervisors.list(WS_A, P_A)).toEqual([]);
        expect(await kit.supervisors.list(WS_A, P_A2)).toEqual([person.id]);
    });
});
