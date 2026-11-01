import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProject, PROJECT_SCHEMA_VERSION, type Project } from '@/domain/project';
import type * as ProjectStoreModule from '../project-store';
import type * as NoticesModule from '../notices';
import { readOnlyText } from '../notice-texts';

/** localStorage for node (the store hydrates from it when it is imported). */
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
const saved = (project: Project) => JSON.stringify({ state: { project }, version: PROJECT_SCHEMA_VERSION });
const savedGuest = (): Project | undefined => {
    const raw = storage.getItem(KEY);
    return raw === null ? undefined : (JSON.parse(raw) as { state: { project: Project } }).state.project;
};

const guestProject: Project = { ...createProject('sample'), meta: { ...createProject('sample').meta, projectName: 'บ้านในเครื่อง' } };
const cloudProject: Project = { ...createProject('blank'), meta: { ...createProject('blank').meta, projectName: 'บ้านบน cloud' } };
const CLOUD = { projectId: '22222222-2222-4222-8222-222222222222', workspaceId: '33333333-3333-4333-8333-333333333333' };

let mod: typeof ProjectStoreModule;
let notices: typeof NoticesModule;

beforeAll(async () => {
    vi.stubGlobal('localStorage', storage);
    storage.setItem(KEY, saved(guestProject));
    mod = await import('../project-store');
    notices = await import('../notices');
});

beforeEach(() => {
    mod.useProjectStore.getState().closeCloudProject();
});

describe('project store binding', () => {
    it('hydrates the guest project as before', () => {
        const s = mod.useProjectStore.getState();
        expect(s.hasHydrated).toBe(true);
        expect(s.binding).toEqual({ kind: 'guest' });
        expect(s.project.meta.projectName).toBe('บ้านในเครื่อง');
    });

    it('guest edits are saved under contrack-project', () => {
        mod.useProjectStore.getState().setMeta({ ownerName: 'สมชาย' });
        expect(savedGuest()?.meta.ownerName).toBe('สมชาย');
    });

    it('cloud edits are never written into the guest key, and the guest project comes back intact', () => {
        const before = storage.getItem(KEY);
        const { openCloudProject, setMeta, setCalculatorInput } = mod.useProjectStore.getState();
        openCloudProject({ ...CLOUD, role: 'estimator' }, cloudProject);
        setMeta({ projectName: 'แก้บน cloud' });
        setCalculatorInput('fill', { width: 3 });
        const s = mod.useProjectStore.getState();
        expect(s.project.meta.projectName).toBe('แก้บน cloud');
        expect(s.guestProject?.meta.projectName).toBe('บ้านในเครื่อง');
        expect(storage.getItem(KEY)).toBe(before);

        s.closeCloudProject();
        const after = mod.useProjectStore.getState();
        expect(after.binding).toEqual({ kind: 'guest' });
        expect(after.project.meta.projectName).toBe('บ้านในเครื่อง');
        expect(after.project.calculators.fill).toBeUndefined();
        expect(after.guestProject).toBeNull();
        expect(storage.getItem(KEY)).toBe(before);
    });

    it('switching between cloud projects keeps the guest project set aside', () => {
        const { openCloudProject } = mod.useProjectStore.getState();
        openCloudProject({ ...CLOUD, role: 'owner' }, cloudProject);
        openCloudProject({ ...CLOUD, projectId: '44444444-4444-4444-8444-444444444444', role: 'owner' }, createProject('sample'));
        expect(mod.useProjectStore.getState().guestProject?.meta.projectName).toBe('บ้านในเครื่อง');
        mod.useProjectStore.getState().closeCloudProject();
        expect(mod.useProjectStore.getState().project.meta.projectName).toBe('บ้านในเครื่อง');
    });

    it('leaving the cloud project restores what another tab saved meanwhile', () => {
        mod.useProjectStore.getState().openCloudProject({ ...CLOUD, role: 'owner' }, cloudProject);
        const otherTab = { ...guestProject, meta: { ...guestProject.meta, projectName: 'แก้จากอีกแท็บ' } };
        storage.setItem(KEY, saved(otherTab));
        mod.useProjectStore.getState().setMeta({ siteAddress: 'x' });
        expect(savedGuest()?.meta.projectName).toBe('แก้จากอีกแท็บ');
        mod.useProjectStore.getState().closeCloudProject();
        expect(mod.useProjectStore.getState().project.meta.projectName).toBe('แก้จากอีกแท็บ');
        storage.setItem(KEY, saved(guestProject));
        void mod.useProjectStore.persist.rehydrate();
    });

    it('a viewer cannot edit (notice instead)', () => {
        const seen: string[] = [];
        const off = notices.onNotice(n => seen.push(n.text));
        mod.useProjectStore.getState().openCloudProject({ ...CLOUD, role: 'viewer' }, cloudProject);
        const s = mod.useProjectStore.getState();
        s.setMeta({ projectName: 'ไม่ควรเปลี่ยน' });
        s.setLevelMark('project-info', 'done');
        s.setBoqOverride('R13', 'qty', 3);
        const after = mod.useProjectStore.getState().project;
        expect(after).toBe(cloudProject);
        expect(seen).toContain(readOnlyText());
        // The sync engine still applies server documents.
        s.replaceProject({ ...cloudProject, journey: { 'project-info': 'done' } });
        expect(mod.useProjectStore.getState().project.journey).toEqual({ 'project-info': 'done' });
        off();
    });

    it('a cloud project is never replaced by "new project"', () => {
        mod.useProjectStore.getState().openCloudProject({ ...CLOUD, role: 'owner' }, cloudProject);
        mod.useProjectStore.getState().newProject('sample');
        expect(mod.useProjectStore.getState().project).toBe(cloudProject);
    });

    it('guest "new project" still works', () => {
        mod.useProjectStore.getState().newProject('blank');
        expect(mod.useProjectStore.getState().project.start).toBe('blank');
        expect(savedGuest()?.start).toBe('blank');
    });
});
