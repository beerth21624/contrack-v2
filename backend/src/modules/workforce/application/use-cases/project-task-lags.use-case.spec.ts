import type { Role } from '@contrack/contract';
import { asProjectId } from '../../../../shared/domain';
import {
    ADMIN, ESTIMATOR, NOW, OUTSIDER, OWNER, OWNER_B, P_A, P_A2, P_ARCHIVED, P_B, ROLE_USERS, VIEWER, WS_A, WS_B, workforceKit,
} from '../../testing/workforce-test-kit';

const code = (r: { ok: boolean; error?: { code: string } }): string => (r.ok ? 'ok' : r.error?.code ?? '?');

describe('project task lags (ช่วงรอ)', () => {
    it('PUT replaces every override (numeric task order, blank note → null); GET reads them back; [] clears them', async () => {
        const kit = workforceKit();
        const put = await kit.putTaskLags.execute({
            userId: ESTIMATOR, projectId: P_A,
            lags: [{ taskId: '5.1', days: 21, note: '  ช่วงฝนตก ปูนแห้งช้า ' }, { taskId: '1.10', days: 0 }, { taskId: '1.5', days: 10, note: '   ' }],
        });
        const expected = [
            { taskId: '1.5', days: 10, note: null }, { taskId: '1.10', days: 0, note: null },
            { taskId: '5.1', days: 21, note: 'ช่วงฝนตก ปูนแห้งช้า' },
        ];
        expect(put.ok && put.value).toEqual({ projectId: P_A, lags: expected });
        const get = await kit.getTaskLags.execute({ userId: VIEWER, projectId: P_A });
        expect(get.ok && get.value).toEqual({ projectId: P_A, lags: expected });

        // Replace-all: 1.10 and 5.1 go, 1.5 changes, 2.4 is new.
        await kit.putTaskLags.execute({ userId: OWNER, projectId: P_A, lags: [{ taskId: '2.4', days: 20 }, { taskId: '1.5', days: 9 }] });
        const after = await kit.getTaskLags.execute({ userId: OWNER, projectId: P_A });
        expect(after.ok && after.value.lags).toEqual([{ taskId: '1.5', days: 9, note: null }, { taskId: '2.4', days: 20, note: null }]);

        await kit.putTaskLags.execute({ userId: OWNER, projectId: P_A, lags: [] });
        const cleared = await kit.getTaskLags.execute({ userId: OWNER, projectId: P_A });
        expect(cleared.ok && cleared.value.lags).toEqual([]);
    });

    it('a changed or new row is stamped with the caller and the clock; an unchanged row keeps its stamp', async () => {
        const kit = workforceKit();
        await kit.putTaskLags.execute({ userId: ESTIMATOR, projectId: P_A, lags: [{ taskId: '1.5', days: 10 }, { taskId: '5.1', days: 21 }] });
        kit.clock.advance(60_000);
        await kit.putTaskLags.execute({ userId: ADMIN, projectId: P_A, lags: [{ taskId: '1.5', days: 10 }, { taskId: '5.1', days: 20 }] });
        expect(kit.taskLags.stampOf(P_A, '1.5')).toEqual({ updatedBy: ESTIMATOR, updatedAt: NOW });
        expect(kit.taskLags.stampOf(P_A, '5.1')).toEqual({ updatedBy: ADMIN, updatedAt: new Date(NOW.getTime() + 60_000) });
    });

    it.each<[Role, string, string]>([
        ['owner', 'ok', 'ok'], ['admin', 'ok', 'ok'], ['estimator', 'ok', 'ok'], ['viewer', 'ok', 'forbidden'],
    ])('%s: read %s, write %s', async (role, read, write) => {
        const kit = workforceKit();
        expect(code(await kit.getTaskLags.execute({ userId: ROLE_USERS[role], projectId: P_A }))).toBe(read);
        expect(code(await kit.listTaskLags.execute({ userId: ROLE_USERS[role], workspaceId: WS_A }))).toBe(read);
        expect(code(await kit.putTaskLags.execute({ userId: ROLE_USERS[role], projectId: P_A, lags: [] }))).toBe(write);
    });

    it('a non-member, a project of another workspace or an unknown project → not_found', async () => {
        const kit = workforceKit();
        const unknown = asProjectId('99999999-0000-4000-8000-000000000000');
        for (const [userId, projectId] of [[OUTSIDER, P_A], [OWNER, P_B], [OWNER, unknown], [OWNER_B, P_A]] as const) {
            expect(code(await kit.getTaskLags.execute({ userId, projectId }))).toBe('not_found');
            expect(code(await kit.putTaskLags.execute({ userId, projectId, lags: [] }))).toBe('not_found');
        }
        expect(code(await kit.listTaskLags.execute({ userId: OUTSIDER, workspaceId: WS_A }))).toBe('not_found');
        expect(code(await kit.listTaskLags.execute({ userId: OWNER, workspaceId: WS_B }))).toBe('not_found');
    });

    it('an archived project: PUT → conflict (nothing stored); GET still reads', async () => {
        const kit = workforceKit();
        const r = await kit.putTaskLags.execute({ userId: OWNER, projectId: P_ARCHIVED, lags: [{ taskId: '1.5', days: 3 }] });
        expect(code(r)).toBe('conflict');
        const get = await kit.getTaskLags.execute({ userId: OWNER, projectId: P_ARCHIVED });
        expect(get.ok && get.value.lags).toEqual([]);
    });

    it('validation: bad task id, duplicate task, days out of range or fractional, long note, too many → validation_failed', async () => {
        const kit = workforceKit();
        for (const lags of [
            [{ taskId: '0.1', days: 1 }], [{ taskId: '1.0', days: 1 }], [{ taskId: '1.100', days: 1 }], [{ taskId: 'x', days: 1 }],
            [{ taskId: '1.5', days: 1 }, { taskId: '1.5', days: 2 }],
            [{ taskId: '1.5', days: -1 }], [{ taskId: '1.5', days: 91 }], [{ taskId: '1.5', days: 1.5 }],
            [{ taskId: '1.5', days: 1, note: 'x'.repeat(201) }],
            Array.from({ length: 65 }, (_, i) => ({ taskId: `${String(1 + Math.floor(i / 20))}.${String(1 + (i % 20))}`, days: 1 })),
        ]) {
            expect(code(await kit.putTaskLags.execute({ userId: OWNER, projectId: P_A, lags }))).toBe('validation_failed');
        }
        expect(code(await kit.putTaskLags.execute({ userId: OWNER, projectId: P_A, lags: [{ taskId: '9.99', days: 90, note: 'x'.repeat(200) }] }))).toBe('ok');
    });

    it('workspace list: every non-archived project of the workspace with overrides, by project id; others left out', async () => {
        const kit = workforceKit();
        await kit.putTaskLags.execute({ userId: OWNER, projectId: P_A2, lags: [{ taskId: '5.1', days: 21 }, { taskId: '1.5', days: 10 }] });
        await kit.putTaskLags.execute({ userId: OWNER, projectId: P_A, lags: [{ taskId: '2.4', days: 0, note: 'ค้ำยันเหล็ก' }] });
        await kit.putTaskLags.execute({ userId: OWNER_B, projectId: P_B, lags: [{ taskId: '1.5', days: 1 }] });
        // Overrides stored before the project was archived are kept but not listed.
        await kit.putTaskLags.execute({ userId: OWNER, projectId: P_ARCHIVED, lags: [] });
        kit.projects.rows.set(P_ARCHIVED, { workspaceId: WS_A, archived: false });
        await kit.putTaskLags.execute({ userId: OWNER, projectId: P_ARCHIVED, lags: [{ taskId: '7.2', days: 2 }] });
        kit.projects.rows.set(P_ARCHIVED, { workspaceId: WS_A, archived: true });

        const list = await kit.listTaskLags.execute({ userId: VIEWER, workspaceId: WS_A });
        expect(list.ok && list.value).toEqual([
            { projectId: P_A, lags: [{ taskId: '2.4', days: 0, note: 'ค้ำยันเหล็ก' }] },
            { projectId: P_A2, lags: [{ taskId: '1.5', days: 10, note: null }, { taskId: '5.1', days: 21, note: null }] },
        ]);
        await kit.putTaskLags.execute({ userId: OWNER, projectId: P_A, lags: [] });
        const after = await kit.listTaskLags.execute({ userId: OWNER, workspaceId: WS_A });
        expect(after.ok && after.value.map(p => p.projectId)).toEqual([P_A2]);
        const b = await kit.listTaskLags.execute({ userId: OWNER_B, workspaceId: WS_B });
        expect(b.ok && b.value).toEqual([{ projectId: P_B, lags: [{ taskId: '1.5', days: 1, note: null }] }]);
    });

    it('deleteByProject removes only that project\'s overrides', async () => {
        const kit = workforceKit();
        await kit.putTaskLags.execute({ userId: OWNER, projectId: P_A, lags: [{ taskId: '1.5', days: 10 }] });
        await kit.putTaskLags.execute({ userId: OWNER, projectId: P_A2, lags: [{ taskId: '1.5', days: 8 }] });
        await kit.taskLags.deleteByProject(WS_A, P_A);
        expect(await kit.taskLags.list(WS_A, P_A)).toEqual([]);
        expect(await kit.taskLags.list(WS_A, P_A2)).toEqual([{ taskId: '1.5', days: 8, note: null }]);
        // Scoped by workspace: another workspace's id does nothing.
        await kit.taskLags.deleteByProject(WS_B, P_A2);
        expect(await kit.taskLags.list(WS_A, P_A2)).toHaveLength(1);
    });
});
