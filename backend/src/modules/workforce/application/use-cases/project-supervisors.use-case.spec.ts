import type { Role } from '@contrack/contract';
import { asPersonId, asProjectId } from '../../../../shared/domain';
import {
    OUTSIDER, OWNER, OWNER_B, P_A, P_ARCHIVED, P_B, ROLE_USERS, WS_B, workforceKit,
} from '../../testing/workforce-test-kit';
import { MAX_SUPERVISORS } from './project-supervisors.use-case';

describe('project supervisors', () => {
    it('PUT replaces the list (order kept, duplicates dropped); GET reads it back; [] clears it', async () => {
        const kit = workforceKit();
        const a = await kit.seedPerson({ role: 'supervisor' });
        const b = await kit.seedPerson({ role: 'engineer' });
        const put = await kit.putSupervisors.execute({ userId: ROLE_USERS.estimator, projectId: P_A, personIds: [b.id, a.id, b.id] });
        expect(put.ok && put.value).toEqual({ projectId: P_A, personIds: [b.id, a.id] });
        const get = await kit.getSupervisors.execute({ userId: ROLE_USERS.viewer, projectId: P_A });
        expect(get.ok && get.value.personIds).toEqual([b.id, a.id]);
        await kit.putSupervisors.execute({ userId: OWNER, projectId: P_A, personIds: [] });
        const cleared = await kit.getSupervisors.execute({ userId: OWNER, projectId: P_A });
        expect(cleared.ok && cleared.value.personIds).toEqual([]);
    });

    it.each<[Role, boolean]>([['owner', true], ['admin', true], ['estimator', true], ['viewer', false]])(
        '%s may set supervisors: %s',
        async (role, allowed) => {
            const kit = workforceKit();
            const r = await kit.putSupervisors.execute({ userId: ROLE_USERS[role], projectId: P_A, personIds: [] });
            expect(r.ok ? 'ok' : r.error.code).toBe(allowed ? 'ok' : 'forbidden');
        },
    );

    it('people must be active and of the project\'s workspace (422)', async () => {
        const kit = workforceKit();
        const foreign = await kit.seedPerson({ by: OWNER_B, workspaceId: WS_B });
        const gone = await kit.seedPerson();
        await kit.archivePerson.execute({ userId: OWNER, workspaceId: gone.workspaceId, personId: gone.id });
        const unknown = asPersonId('99999999-0000-4000-8000-000000000000');
        for (const id of [foreign.id, gone.id, unknown]) {
            const r = await kit.putSupervisors.execute({ userId: OWNER, projectId: P_A, personIds: [id] });
            expect(!r.ok && r.error.code).toBe('unprocessable');
            expect(!r.ok && r.error.details).toEqual({ field: 'personIds', ids: [id] });
        }
        const many = Array.from({ length: MAX_SUPERVISORS + 1 }, (_, i) => `50000000-0000-4000-8000-${i.toString(16).padStart(12, '0')}`);
        const tooMany = await kit.putSupervisors.execute({ userId: OWNER, projectId: P_A, personIds: many });
        expect(!tooMany.ok && tooMany.error.code).toBe('validation_failed');
    });

    it('another tenant\'s or an unknown project → not_found; archived → conflict on PUT, readable on GET', async () => {
        const kit = workforceKit();
        for (const projectId of [P_B, asProjectId('99999999-0000-4000-8000-000000000000')]) {
            const get = await kit.getSupervisors.execute({ userId: OWNER, projectId });
            expect(!get.ok && get.error.code).toBe('not_found');
            const put = await kit.putSupervisors.execute({ userId: OWNER, projectId, personIds: [] });
            expect(!put.ok && put.error.code).toBe('not_found');
        }
        const outsider = await kit.getSupervisors.execute({ userId: OUTSIDER, projectId: P_A });
        expect(!outsider.ok && outsider.error.code).toBe('not_found');
        const archived = await kit.putSupervisors.execute({ userId: OWNER, projectId: P_ARCHIVED, personIds: [] });
        expect(!archived.ok && archived.error.code).toBe('conflict');
        expect((await kit.getSupervisors.execute({ userId: OWNER, projectId: P_ARCHIVED })).ok).toBe(true);
    });
});
