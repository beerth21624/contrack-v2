// QA edge tests for the project store: new project, guest persistence format, overrides, journey marks, read-only viewers.
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProject, PROJECT_SCHEMA_VERSION, type Project } from '@/domain/project';
import type { AppNotice } from '../notices';
import type * as ProjectStoreModule from '../project-store';
import type * as NoticesModule from '../notices';

class MemoryStorage implements Storage {
    private map = new Map<string, string>();
    get length() { return this.map.size; }
    clear() { this.map.clear(); }
    getItem(k: string) { return this.map.get(k) ?? null; }
    key(i: number) { return [...this.map.keys()][i] ?? null; }
    removeItem(k: string) { this.map.delete(k); }
    setItem(k: string, v: string) { this.map.set(k, v); }
}

const storage = new MemoryStorage();
const KEY = 'contrack-project';
const ID = { projectId: '22222222-2222-4222-8222-222222222222', workspaceId: '33333333-3333-4333-8333-333333333333' };

let mod: typeof ProjectStoreModule;
let notices: typeof NoticesModule;
const store = () => mod.useProjectStore;
const state = () => mod.useProjectStore.getState();
const stored = (): { state: { project: Project }; version: number } | null => {
    const raw = storage.getItem(KEY);
    return raw === null ? null : (JSON.parse(raw) as { state: { project: Project }; version: number });
};

let heard: AppNotice[] = [];

beforeAll(async () => {
    vi.stubGlobal('localStorage', storage);
    mod = await import('../project-store');
    notices = await import('../notices');
    notices.onNotice(n => heard.push(n));
});

beforeEach(() => {
    state().closeCloudProject();
    store().setState({ project: createProject('sample'), binding: { kind: 'guest' }, guestProject: null });
    heard = [];
});

describe('first start and new project', () => {
    it('with nothing saved the working copy is the sample project and hydration is marked done', () => {
        expect(state().hasHydrated).toBe(true);
        expect(state().binding).toEqual({ kind: 'guest' });
        expect(state().project.start).toBe('sample');
    });

    it('newProject("blank") starts a blank project: no name, no overrides, no journey marks', () => {
        state().setBoqOverride('R9', 'qty', 3);
        state().setLevelMark('layout', 'done');
        state().newProject('blank');
        const p = state().project;
        expect(p.start).toBe('blank');
        expect(p.meta.projectName).toBe('');
        expect(p.boqOverrides).toEqual({});
        expect(p.journey).toEqual({});
        expect(p.calculators).toEqual({});
    });

    it('newProject("sample") throws the edits away and restores the Excel sample', () => {
        state().setMeta({ projectName: 'อะไรสักอย่าง' });
        state().newProject('sample');
        expect(state().project).toEqual(createProject('sample'));
    });

    it('resetProject goes back to the sample (not blank)', () => {
        state().newProject('blank');
        state().resetProject();
        expect(state().project.start).toBe('sample');
    });

    it('new projects are independent objects (no shared mutable state between resets)', () => {
        state().newProject('blank');
        const a = state().project;
        state().newProject('blank');
        expect(state().project).not.toBe(a);
        expect(state().project.meta).not.toBe(a.meta);
    });
});

describe('guest persistence format', () => {
    it('is saved under "contrack-project" as {state:{project},version}', () => {
        state().setMeta({ projectName: 'บ้านเก็บไว้' });
        const saved = stored();
        expect(saved).not.toBeNull();
        expect(Object.keys(saved ?? {}).sort()).toEqual(['state', 'version']);
        expect(saved?.version).toBe(PROJECT_SCHEMA_VERSION);
        expect(Object.keys(saved?.state ?? {})).toEqual(['project']);
        expect(saved?.state.project.meta.projectName).toBe('บ้านเก็บไว้');
    });

    it('only the project is saved: no hasHydrated flag, no functions, no binding', () => {
        state().setMeta({ projectName: 'x' });
        const raw = storage.getItem(KEY) ?? '';
        expect(raw).not.toContain('hasHydrated');
        expect(raw).not.toContain('binding');
        expect(raw).not.toContain('guestProject');
    });

    it('every edit is saved (latest write wins)', () => {
        state().setMeta({ projectName: 'one' });
        state().setMeta({ projectName: 'two' });
        expect(stored()?.state.project.meta.projectName).toBe('two');
    });

    it('the saved project is valid JSON that survives a round trip', () => {
        state().setBoqOverride('R9', 'mat', 12.5);
        state().setLevelMark('layout', 'skipped');
        const back = stored()?.state.project;
        expect(back).toEqual(state().project);
    });

    it('the project is saved without undefined holes (cleared fields are really gone)', () => {
        state().setBoqOverride('R9', 'qty', 3);
        state().setBoqOverride('R9', 'qty', undefined);
        expect(storage.getItem(KEY)).not.toContain('R9');
    });
});

describe('BOQ overrides', () => {
    it('sets a field, keeps others, and a second line is separate', () => {
        state().setBoqOverride('R9', 'qty', 3);
        state().setBoqOverride('R9', 'mat', 10);
        state().setBoqOverride('R16', 'lab', 5);
        expect(state().project.boqOverrides).toEqual({ R9: { qty: 3, mat: 10 }, R16: { lab: 5 } });
    });

    it('overwriting a field replaces the value', () => {
        state().setBoqOverride('R9', 'qty', 3);
        state().setBoqOverride('R9', 'qty', 4);
        expect(state().project.boqOverrides.R9).toEqual({ qty: 4 });
    });

    it('clearing one field keeps the other; clearing the last one removes the line entry', () => {
        state().setBoqOverride('R9', 'qty', 3);
        state().setBoqOverride('R9', 'mat', 10);
        state().setBoqOverride('R9', 'qty', undefined);
        expect(state().project.boqOverrides.R9).toEqual({ mat: 10 });
        state().setBoqOverride('R9', 'mat', undefined);
        expect('R9' in state().project.boqOverrides).toBe(false);
        expect(state().project.boqOverrides).toEqual({});
    });

    it('clearing a field of a line with no override does not create an entry', () => {
        state().setBoqOverride('R77', 'qty', undefined);
        expect(state().project.boqOverrides).toEqual({});
    });

    it('0 is a real value and is kept; negative and text fields too', () => {
        state().setBoqOverride('R9', 'qty', 0);
        state().setBoqOverride('R9', 'lab', -5);
        state().setBoqOverride('R9', 'note', 'หมายเหตุ');
        expect(state().project.boqOverrides.R9).toEqual({ qty: 0, lab: -5, note: 'หมายเหตุ' });
    });

    it('resetBoqSection removes only the listed lines; unknown keys are ignored; empty list is a no-op', () => {
        state().setBoqOverride('R9', 'qty', 1);
        state().setBoqOverride('R16', 'qty', 2);
        state().setBoqOverride('R32', 'qty', 3);
        state().resetBoqSection(['R9', 'R32', 'NOPE']);
        expect(state().project.boqOverrides).toEqual({ R16: { qty: 2 } });
        state().resetBoqSection([]);
        expect(state().project.boqOverrides).toEqual({ R16: { qty: 2 } });
    });

    it('editing never mutates the previous state object (immutability, selectors can rely on identity)', () => {
        state().setBoqOverride('R9', 'qty', 1);
        const before = state().project;
        const overridesBefore = before.boqOverrides;
        state().setBoqOverride('R9', 'qty', 2);
        expect(state().project).not.toBe(before);
        expect(overridesBefore.R9).toEqual({ qty: 1 });
    });
});

describe('meta, calculators and planning edits', () => {
    it('setMeta merges a patch and leaves other fields', () => {
        state().setMeta({ projectName: 'A' });
        state().setMeta({ ownerName: 'B' });
        expect(state().project.meta).toMatchObject({ projectName: 'A', ownerName: 'B', revision: '00' });
    });

    it('setCalculatorInput stores an input; undefined goes back to the Excel sample (key removed)', () => {
        state().setCalculatorInput('footing', { a: 1 });
        state().setCalculatorInput('piles', { b: 2 });
        expect(state().project.calculators).toEqual({ footing: { a: 1 }, piles: { b: 2 } });
        state().setCalculatorInput('footing', undefined);
        expect(state().project.calculators).toEqual({ piles: { b: 2 } });
        state().setCalculatorInput('nothing', undefined);
        expect(state().project.calculators).toEqual({ piles: { b: 2 } });
    });

    it('setPlanning merges per sheet; a sheet set to undefined returns to the sample; all cleared leaves {}', () => {
        const cashflow = { quotationFactor: 1.5 } as never;
        const schedule = { projectName: 'p' } as never;
        state().setPlanning({ cashflow });
        state().setPlanning({ schedule });
        expect(Object.keys(state().project.planning ?? {}).sort()).toEqual(['cashflow', 'schedule']);
        state().setPlanning({ cashflow: undefined });
        expect(Object.keys(state().project.planning ?? {})).toEqual(['schedule']);
        state().setPlanning({ schedule: undefined });
        expect(state().project.planning).toEqual({});
    });
});

describe('journey marks (done / skipped / undo)', () => {
    it('marks a level done, then skipped, then undoes it', () => {
        state().setLevelMark('layout', 'done');
        expect(state().project.journey).toEqual({ layout: 'done' });
        state().setLevelMark('layout', 'skipped');
        expect(state().project.journey).toEqual({ layout: 'skipped' });
        state().setLevelMark('layout', undefined);
        expect(state().project.journey).toEqual({});
    });

    it('marking one level never touches another', () => {
        state().setLevelMark('layout', 'done');
        state().setLevelMark('piles', 'skipped');
        state().setLevelMark('layout', undefined);
        expect(state().project.journey).toEqual({ piles: 'skipped' });
    });

    it('undoing a level that has no mark is harmless', () => {
        state().setLevelMark('layout', undefined);
        expect(state().project.journey).toEqual({});
    });

    it('works on a legacy project with no journey field', () => {
        const legacy: Project = { ...createProject('sample') };
        delete legacy.journey;
        store().setState({ project: legacy });
        state().setLevelMark('layout', 'done');
        expect(state().project.journey).toEqual({ layout: 'done' });
    });

    it('a mark is saved with the project', () => {
        state().setLevelMark('layout', 'skipped');
        expect(stored()?.state.project.journey).toEqual({ layout: 'skipped' });
    });
});

describe('cloud binding: viewer is read-only, others can edit', () => {
    const openAs = (role: 'viewer' | 'editor' | 'owner' | 'admin') => {
        const cloud = { ...createProject('blank'), meta: { ...createProject('blank').meta, projectName: 'cloud' } };
        state().openCloudProject({ ...ID, role: role as never }, cloud);
    };

    it('isReadOnly is true only for a cloud viewer', () => {
        expect(mod.isReadOnly({ kind: 'guest' })).toBe(false);
        expect(mod.isReadOnly({ kind: 'cloud', ...ID, role: 'viewer' as never })).toBe(true);
        expect(mod.isReadOnly({ kind: 'cloud', ...ID, role: 'editor' as never })).toBe(false);
        expect(mod.isReadOnly({ kind: 'cloud', ...ID, role: 'owner' as never })).toBe(false);
    });

    it('every edit action is blocked for a viewer, the project stays identical, one warning per attempt', () => {
        openAs('viewer');
        const before = structuredClone(state().project);
        state().setMeta({ projectName: 'hacked' });
        state().setBoqOverride('R9', 'qty', 99);
        state().resetBoqSection(['R9']);
        state().setCalculatorInput('footing', { a: 1 });
        state().setPlanning({ cashflow: { quotationFactor: 9 } as never });
        state().setLevelMark('layout', 'done');
        expect(state().project).toEqual(before);
        expect(heard).toHaveLength(6);
        for (const n of heard) expect(n).toMatchObject({ level: 'warning', text: mod.READ_ONLY_TEXT, key: 'read-only' });
    });

    it('an editor can edit the cloud copy; nothing leaks to the guest key', () => {
        const guestBefore = storage.getItem(KEY);
        openAs('editor');
        state().setMeta({ projectName: 'edited in cloud' });
        state().setBoqOverride('R9', 'qty', 2);
        expect(state().project.meta.projectName).toBe('edited in cloud');
        expect(heard).toHaveLength(0);
        expect(storage.getItem(KEY)).toBe(guestBefore);
    });

    it('role change viewer -> editor lifts the block, editor -> viewer applies it', () => {
        openAs('viewer');
        state().setMeta({ projectName: 'no' });
        expect(state().project.meta.projectName).toBe('cloud');
        state().setCloudRole('editor' as never);
        state().setMeta({ projectName: 'yes' });
        expect(state().project.meta.projectName).toBe('yes');
        state().setCloudRole('viewer' as never);
        state().setMeta({ projectName: 'blocked again' });
        expect(state().project.meta.projectName).toBe('yes');
    });

    it('setCloudRole on a guest does nothing', () => {
        state().setCloudRole('viewer' as never);
        expect(state().binding).toEqual({ kind: 'guest' });
        expect(mod.isReadOnly(state().binding)).toBe(false);
    });

    it('"new project" is refused in any cloud role with a notice, the cloud project stays', () => {
        openAs('owner');
        state().newProject('blank');
        state().resetProject();
        expect(state().project.meta.projectName).toBe('cloud');
        expect(heard.map(n => n.key)).toEqual(['cloud-new-project', 'cloud-new-project']);
    });

    it('replaceProject (sync engine) works even for a viewer, without notice', () => {
        openAs('viewer');
        const remote = { ...createProject('sample'), meta: { ...createProject('sample').meta, projectName: 'from server' } };
        state().replaceProject(remote);
        expect(state().project.meta.projectName).toBe('from server');
        expect(heard).toHaveLength(0);
    });

    it('closing the cloud project returns the guest project and read-only ends', () => {
        state().setMeta({ projectName: 'my guest house' });
        openAs('viewer');
        expect(state().guestProject?.meta.projectName).toBe('my guest house');
        state().closeCloudProject();
        expect(state().binding).toEqual({ kind: 'guest' });
        expect(state().project.meta.projectName).toBe('my guest house');
        expect(state().guestProject).toBeNull();
        state().setMeta({ projectName: 'editable again' });
        expect(state().project.meta.projectName).toBe('editable again');
    });

    it('closeCloudProject in guest mode is a no-op', () => {
        const p = state().project;
        state().closeCloudProject();
        expect(state().project).toBe(p);
    });

    it('selectGuestProject gives the working copy in guest mode and the set-aside one in cloud mode', () => {
        state().setMeta({ projectName: 'guest' });
        expect(mod.selectGuestProject(state()).meta.projectName).toBe('guest');
        openAs('editor');
        expect(mod.selectGuestProject(state()).meta.projectName).toBe('guest');
        expect(state().project.meta.projectName).toBe('cloud');
    });
});
