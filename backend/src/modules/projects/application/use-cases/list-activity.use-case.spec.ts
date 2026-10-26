import { ROLES } from '@contrack/contract';
import { OUTSIDER, OWNER, OWNER_B, ROLE_USERS, WS_B, projectsKit } from '../../testing/projects-test-kit';

async function projectWithActivity(writes: number) {
    const kit = projectsKit();
    const p = await kit.seedProject();
    for (let i = 0; i < writes; i += 1) {
        const r = await kit.putDoc.execute({ userId: OWNER, projectId: p.id, docKey: 'calc:fill', data: { width: i + 1 }, baseVersion: i });
        if (!r.ok) throw new Error(r.error.message);
    }
    return { kit, p };
}

describe('ListActivityUseCase', () => {
    it('lists newest first, with a default limit of 50', async () => {
        const { kit, p } = await projectWithActivity(55);
        const r = await kit.listActivity.execute({ userId: OWNER, projectId: p.id });
        if (!r.ok) throw new Error(r.error.message);
        expect(r.value).toHaveLength(50);
        const ids = r.value.map(e => e.id);
        expect([...ids].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))).toEqual(ids);
        expect(r.value[0]?.action).toBe('doc.updated');
    });

    it('pages with the bigint cursor `before` without gaps or repeats', async () => {
        const { kit, p } = await projectWithActivity(6); // 7 entries with project.created
        const seen: bigint[] = [];
        let before: bigint | undefined;
        for (;;) {
            const r = await kit.listActivity.execute({ userId: OWNER, projectId: p.id, before, limit: 3 });
            if (!r.ok) throw new Error(r.error.message);
            if (r.value.length === 0) break;
            seen.push(...r.value.map(e => e.id));
            before = r.value.at(-1)?.id;
        }
        expect(seen).toHaveLength(7);
        expect(new Set(seen).size).toBe(7);
        const all = await kit.listActivity.execute({ userId: OWNER, projectId: p.id, limit: 200 });
        expect(all.ok && all.value.map(e => e.id)).toEqual(seen);
        expect(all.ok && all.value.at(-1)?.action).toBe('project.created');
    });

    it('never mixes in another project\'s entries', async () => {
        const { kit, p } = await projectWithActivity(2);
        const other = await kit.seedProject({ name: 'Other' });
        const r = await kit.listActivity.execute({ userId: OWNER, projectId: other.id });
        expect(r.ok && r.value.map(e => e.projectId)).toEqual([other.id]);
        const mine = await kit.listActivity.execute({ userId: OWNER, projectId: p.id });
        expect(mine.ok && mine.value.every(e => e.projectId === p.id)).toBe(true);
    });

    it('refuses a limit outside 1–200 and a non-positive cursor', async () => {
        const { kit, p } = await projectWithActivity(0);
        for (const limit of [0, 201, 1.5]) {
            const r = await kit.listActivity.execute({ userId: OWNER, projectId: p.id, limit });
            expect(!r.ok && r.error.code).toBe('validation_failed');
        }
        const r = await kit.listActivity.execute({ userId: OWNER, projectId: p.id, before: 0n });
        expect(!r.ok && r.error.code).toBe('validation_failed');
    });

    it.each(ROLES)('%s may read the activity', async role => {
        const { kit, p } = await projectWithActivity(0);
        expect((await kit.listActivity.execute({ userId: ROLE_USERS[role], projectId: p.id })).ok).toBe(true);
    });

    it('a non-member or another tenant → not_found', async () => {
        const { kit, p } = await projectWithActivity(0);
        const outsider = await kit.listActivity.execute({ userId: OUTSIDER, projectId: p.id });
        expect(!outsider.ok && outsider.error.code).toBe('not_found');
        const cross = await kit.listActivity.execute({ userId: OWNER_B, projectId: p.id });
        expect(!cross.ok && cross.error.code).toBe('not_found');
        const theirs = await kit.seedProject({ by: OWNER_B, workspaceId: WS_B });
        const reverse = await kit.listActivity.execute({ userId: OWNER, projectId: theirs.id });
        expect(!reverse.ok && reverse.error.code).toBe('not_found');
    });
});
