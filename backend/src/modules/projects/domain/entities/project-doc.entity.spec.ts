import { asProjectId, asUserId, asWorkspaceId } from '../../../../shared/domain';
import { ProjectDoc } from './project-doc.entity';

const base = {
    projectId: asProjectId('00000000-0000-4000-8000-000000000001'),
    workspaceId: asWorkspaceId('00000000-0000-4000-8000-0000000000aa'),
    docKey: 'calc:fill' as const,
    updatedBy: asUserId('00000000-0000-4000-8000-0000000000bb'),
    now: new Date('2026-01-01T00:00:00.000Z'),
};

describe('ProjectDoc', () => {
    it('a first write (base 0) is version 1; each write adds exactly 1', () => {
        expect(ProjectDoc.write({ ...base, data: { width: 1 }, baseVersion: 0 }).version).toBe(1);
        expect(ProjectDoc.write({ ...base, data: { width: 1 }, baseVersion: 7 }).version).toBe(8);
    });

    it('null data is a reset', () => {
        const d = ProjectDoc.write({ ...base, data: null, baseVersion: 3 });
        expect(d.isReset).toBe(true);
        expect(d.version).toBe(4);
        expect(d.toEntry()).toEqual({ docKey: 'calc:fill', data: null });
    });

    it('round-trips through toProps / rehydrate', () => {
        const d = ProjectDoc.write({ ...base, data: { width: 2 }, baseVersion: 1 });
        expect(ProjectDoc.rehydrate(d.toProps()).toProps()).toEqual(d.toProps());
    });

    it('refuses impossible versions (bugs throw)', () => {
        expect(() => ProjectDoc.write({ ...base, data: {}, baseVersion: -1 })).toThrow();
        expect(() => ProjectDoc.write({ ...base, data: {}, baseVersion: 1.5 })).toThrow();
        const props = ProjectDoc.write({ ...base, data: {}, baseVersion: 0 }).toProps();
        expect(() => ProjectDoc.rehydrate({ ...props, version: 0 })).toThrow();
    });
});
