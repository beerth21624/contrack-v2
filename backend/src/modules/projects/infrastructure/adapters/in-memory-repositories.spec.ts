// The in-memory adapters honour the same contract as the Drizzle ones (CAS, tenant scope, lock, cursor).
import { asProjectId, asUserId, asWorkspaceId } from '../../../../shared/domain';
import { ActivityEntry } from '../../domain/entities/activity-entry.entity';
import { ProjectDoc } from '../../domain/entities/project-doc.entity';
import { InMemoryActivityRepository } from './in-memory-activity.repository';
import { InMemoryProjectDocRepository } from './in-memory-project-doc.repository';
import { InMemoryProjectRepository } from './in-memory-project.repository';

const projectId = asProjectId('00000000-0000-4000-8000-000000000001');
const ws = asWorkspaceId('00000000-0000-4000-8000-0000000000aa');
const otherWs = asWorkspaceId('00000000-0000-4000-8000-0000000000bb');
const user = asUserId('00000000-0000-4000-8000-0000000000cc');
const now = new Date('2026-01-01T00:00:00.000Z');

const doc = (baseVersion: number, data: unknown, workspaceId = ws) =>
    ProjectDoc.write({ projectId, workspaceId, docKey: 'calc:fill', data, baseVersion, updatedBy: user, now });

describe('InMemoryProjectDocRepository.write (compare-and-set)', () => {
    it('base 0 inserts only when absent', async () => {
        const repo = new InMemoryProjectDocRepository();
        expect(await repo.write(doc(0, { width: 1 }), 0)).toBe('written');
        expect(await repo.write(doc(0, { width: 2 }), 0)).toBe('conflict');
        expect((await repo.find(ws, projectId, 'calc:fill'))?.data).toEqual({ width: 1 });
    });

    it('base n updates only when the stored version is n', async () => {
        const repo = new InMemoryProjectDocRepository();
        await repo.write(doc(0, { width: 1 }), 0);
        expect(await repo.write(doc(2, { width: 3 }), 2)).toBe('conflict');
        expect(await repo.write(doc(1, { width: 2 }), 1)).toBe('written');
        expect(await repo.write(doc(1, { width: 9 }), 1)).toBe('conflict');
        const stored = await repo.find(ws, projectId, 'calc:fill');
        expect(stored?.version).toBe(2);
        expect(stored?.data).toEqual({ width: 2 });
    });

    it('is scoped by workspace and stores a copy', async () => {
        const repo = new InMemoryProjectDocRepository();
        const data = { width: 1 };
        await repo.write(doc(0, data), 0);
        data.width = 999;
        expect((await repo.find(ws, projectId, 'calc:fill'))?.data).toEqual({ width: 1 });
        expect(await repo.find(otherWs, projectId, 'calc:fill')).toBeUndefined();
        expect(await repo.listByProject(otherWs, projectId)).toEqual([]);
        expect(await repo.write(doc(1, { width: 2 }, otherWs), 1)).toBe('conflict');
    });

    it('refuses a doc whose version is not base + 1 (a bug)', async () => {
        const repo = new InMemoryProjectDocRepository();
        await expect(repo.write(doc(0, {}), 1)).rejects.toThrow();
    });
});

describe('InMemoryProjectRepository.lockForUpdate', () => {
    it('serialises holders: the second waits until the first one\'s work is done', async () => {
        const repo = new InMemoryProjectRepository();
        const order: string[] = [];
        const holder = async (name: string) => {
            await repo.lockForUpdate(ws, projectId);
            order.push(`${name}:start`);
            await Promise.resolve();
            await Promise.resolve();
            order.push(`${name}:end`);
        };
        await Promise.all([holder('a'), holder('b')]);
        expect(order).toEqual(['a:start', 'a:end', 'b:start', 'b:end']);
    });
});

describe('InMemoryActivityRepository', () => {
    it('gives growing bigint ids and pages by `before`', async () => {
        const repo = new InMemoryActivityRepository();
        for (let i = 0; i < 5; i += 1) {
            await repo.append(ActivityEntry.record({ workspaceId: ws, projectId, userId: user, action: 'doc.updated', at: now }));
        }
        const first = await repo.list(ws, projectId, { limit: 2 });
        expect(first.map(e => e.id)).toEqual([5n, 4n]);
        const next = await repo.list(ws, projectId, { before: 4n, limit: 2 });
        expect(next.map(e => e.id)).toEqual([3n, 2n]);
        expect(await repo.list(otherWs, projectId, { limit: 10 })).toEqual([]);
    });
});
