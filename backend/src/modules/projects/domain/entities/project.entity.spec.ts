import { PROJECT_SCHEMA_VERSION } from '@contrack/domain/project';
import { asProjectId, asUserId, asWorkspaceId } from '../../../../shared/domain';
import { ProjectName } from '../value-objects/project-name.value-object';
import { ENGINE_VERSION, Project, type ProjectSummary } from './project.entity';

const name = (v: string): ProjectName => {
    const r = ProjectName.create(v);
    if (!r.ok) throw new Error('bad name');
    return r.value;
};
const t0 = new Date('2026-01-01T00:00:00.000Z');
const t1 = new Date('2026-01-02T00:00:00.000Z');
const summary: ProjectSummary = { constructionTotal: 1000, preConstructionTotal: 100, levelsDone: 1, levelsTotal: 40 };

const make = (): Project => Project.create({
    id: asProjectId('00000000-0000-4000-8000-000000000001'),
    workspaceId: asWorkspaceId('00000000-0000-4000-8000-0000000000aa'),
    name: name('บ้าน'),
    start: 'blank',
    summary,
    createdBy: asUserId('00000000-0000-4000-8000-0000000000bb'),
    now: t0,
});

describe('Project', () => {
    it('is created with the engine, schema version, summary and no archive date', () => {
        const p = make();
        expect(p.engineVersion).toBe(ENGINE_VERSION);
        expect(p.engineVersion).toBe('excel-v5');
        expect(p.schemaVersion).toBe(PROJECT_SCHEMA_VERSION);
        expect(p.summary).toEqual(summary);
        expect(p.createdAt).toEqual(t0);
        expect(p.updatedAt).toEqual(t0);
        expect(p.archivedAt).toBeNull();
        expect(p.isArchived).toBe(false);
    });

    it('round-trips through toProps / rehydrate', () => {
        const p = make();
        p.archive(t1);
        const back = Project.rehydrate(p.toProps());
        expect(back.toProps()).toEqual(p.toProps());
    });

    it('renames (no-op for the same name)', () => {
        const p = make();
        expect(p.rename(name('บ้าน'), t1)).toBe(false);
        expect(p.updatedAt).toEqual(t0);
        expect(p.rename(name('บ้านใหม่'), t1)).toBe(true);
        expect(p.name.value).toBe('บ้านใหม่');
        expect(p.updatedAt).toEqual(t1);
    });

    it('archives and restores (each only once)', () => {
        const p = make();
        expect(p.restore(t1)).toBe(false);
        expect(p.archive(t1)).toBe(true);
        expect(p.isArchived).toBe(true);
        expect(p.archivedAt).toEqual(t1);
        expect(p.archive(t1)).toBe(false);
        expect(p.restore(t1)).toBe(true);
        expect(p.archivedAt).toBeNull();
    });

    it('applySummary stores the totals and the time', () => {
        const p = make();
        const next = { ...summary, constructionTotal: 2000 };
        p.applySummary(next, t1);
        expect(p.summary).toEqual(next);
        expect(p.updatedAt).toEqual(t1);
    });

    it('never leaks its state by reference', () => {
        const p = make();
        p.createdAt.setFullYear(1999);
        (p.summary as { constructionTotal: number }).constructionTotal = -1;
        expect(p.createdAt).toEqual(t0);
        expect(p.summary.constructionTotal).toBe(1000);
    });
});
