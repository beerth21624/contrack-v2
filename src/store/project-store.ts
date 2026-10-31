'use client';

import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import type { BoqLineKey, BoqLineOverride } from '@/domain/boq/types';
import type { PlanningInput } from '@/domain/planning';
import { createProject, PROJECT_SCHEMA_VERSION, type Project, type ProjectMeta, type ProjectStart } from '@/domain/project';
import type { LevelMark } from '@/domain/journey/progress';
import { can, type Role } from '@/shared/contract';
import { emitNotice } from './notices';

/** Field of a BOQ line the user can edit on the BOQ (Home) page. */
export type BoqEditableField = keyof BoqLineOverride;

/** localStorage key of the guest project (the project of this browser). */
export const GUEST_PROJECT_KEY = 'contrack-project';

export interface CloudBinding {
    kind: 'cloud';
    projectId: string;
    workspaceId: string;
    role: Role;
}

/**
 * Where the working copy in `project` belongs:
 * - guest: the project of this browser, saved to localStorage (`contrack-project`) as before;
 * - cloud: a workspace project, held in memory only and saved to the server by the sync engine.
 */
export type ProjectBinding = { kind: 'guest' } | CloudBinding;

const GUEST: ProjectBinding = { kind: 'guest' };

export const READ_ONLY_TEXT = 'คุณมีสิทธิ์ดูอย่างเดียวในโครงการนี้ แก้ไขไม่ได้';
export const CLOUD_NEW_PROJECT_TEXT = 'โครงการบนคลาวด์ เริ่มใหม่ทับไม่ได้ — สร้างโครงการใหม่ที่หน้า "โครงการทั้งหมด"';

interface ProjectState {
    hasHydrated: boolean;
    setHasHydrated: () => void;
    project: Project;
    setMeta: (patch: Partial<ProjectMeta>) => void;
    /** Set (or clear with `undefined`) one edited field of a BOQ line. */
    setBoqOverride: <F extends BoqEditableField>(key: BoqLineKey, field: F, value: BoqLineOverride[F] | undefined) => void;
    resetBoqSection: (keys: BoqLineKey[]) => void;
    /** Replace a calculator's whole input (undefined = back to the Excel sample). */
    setCalculatorInput: (id: string, input: unknown) => void;
    /** Merge planning inputs per sheet (manday / schedule / cashflow); a sheet set to undefined goes back to the Excel sample. */
    setPlanning: (patch: { [K in keyof PlanningInput]?: PlanningInput[K] | undefined }) => void;
    /** Mark a journey level passed / not in this project, or clear the mark (undefined). */
    setLevelMark: (levelId: string, mark: LevelMark | undefined) => void;
    /** Throw the current project away and start a new one: blank (from a plan) or the Excel sample house. */
    newProject: (start: ProjectStart) => void;
    resetProject: () => void;

    // ── cloud binding ──
    binding: ProjectBinding;
    /** The guest project kept aside while a cloud project is open (null in guest mode). */
    guestProject: Project | null;
    /** Make a cloud project the working copy. The guest project is kept aside (and stays saved in this browser). */
    openCloudProject: (binding: Omit<CloudBinding, 'kind'>, project: Project) => void;
    /** Back to the guest project of this browser. */
    closeCloudProject: () => void;
    /** Replace the working copy without the edit checks (the sync engine: remote docs, conflicts, reverts). */
    replaceProject: (project: Project) => void;
    /** The user's role in the open cloud project's workspace changed. */
    setCloudRole: (role: Role) => void;
}

/** A cloud project opens read-only for a role that may not edit it (viewer, and the ERP purchasing/accounting/foreman). */
export function isReadOnly(binding: ProjectBinding): boolean {
    return binding.kind === 'cloud' && !can(binding.role, 'projects.edit');
}

/** Stable fallback (selectors must not return a new object on every call). */
const FRESH_PROJECT: Project = createProject();

/** The guest project wherever it is right now (the working copy, or kept aside while a cloud project is open). */
export function selectGuestProject(s: Pick<ProjectState, 'binding' | 'project' | 'guestProject'>): Project {
    return s.binding.kind === 'guest' ? s.project : (s.guestProject ?? FRESH_PROJECT);
}

/** The guest project as saved in this browser (another tab may have changed it while a cloud project was open). */
function readSavedGuestProject(): Project | null {
    try {
        const raw = localStorage.getItem(GUEST_PROJECT_KEY);
        if (raw === null) return null;
        const saved = JSON.parse(raw) as { state?: { project?: Project }; version?: number };
        return saved.version === PROJECT_SCHEMA_VERSION && saved.state?.project ? saved.state.project : null;
    } catch {
        return null;
    }
}

/**
 * localStorage, except that nothing is written while a cloud project is the working copy: the guest key only ever
 * holds the guest project, and a cloud tab never overwrites what a guest tab saved.
 */
let writesSuspended = false;
const isRecord = (v: unknown): v is Record<string, unknown> & Partial<Project> =>
    v !== null && typeof v === 'object' && !Array.isArray(v);
const guestStorage: StateStorage = {
    // Text that is not JSON (hand-edited or cut-off storage) reads as nothing saved: a fresh project instead of a
    // hydration error that would leave every page on its spinner.
    getItem: (name) => {
        const raw = localStorage.getItem(name);
        if (raw === null) return null;
        try {
            JSON.parse(raw);
            return raw;
        } catch {
            return null;
        }
    },
    setItem: (name, value) => {
        if (!writesSuspended) localStorage.setItem(name, value);
    },
    removeItem: (name) => { localStorage.removeItem(name); },
};

export const useProjectStore = create<ProjectState>()(
    persist(
        (set, get) => {
            /** Edits of the working copy; a viewer of a cloud project cannot edit (notice instead). */
            const edit = (fn: (s: ProjectState) => Partial<ProjectState>) => {
                if (isReadOnly(get().binding)) {
                    emitNotice({ level: 'warning', text: READ_ONLY_TEXT, key: 'read-only' });
                    return;
                }
                set(fn);
            };
            const startOver = (start: ProjectStart | undefined) => {
                if (get().binding.kind === 'cloud') {
                    emitNotice({ level: 'warning', text: CLOUD_NEW_PROJECT_TEXT, key: 'cloud-new-project' });
                    return;
                }
                set({ project: createProject(start) });
            };
            return {
                hasHydrated: false,
                setHasHydrated: () => set({ hasHydrated: true }),
                project: createProject(),
                setMeta: (patch) => edit(s => ({ project: { ...s.project, meta: { ...s.project.meta, ...patch } } })),
                setBoqOverride: (key, field, value) => edit(s => {
                    const merged: BoqLineOverride = { ...s.project.boqOverrides[key], [field]: value };
                    const current = Object.fromEntries(
                        Object.entries(merged).filter(([, v]) => v !== undefined),
                    ) as BoqLineOverride;
                    const others = Object.entries(s.project.boqOverrides).filter(([k]) => k !== key);
                    const boqOverrides = Object.fromEntries(
                        Object.keys(current).length === 0 ? others : [...others, [key, current]],
                    );
                    return { project: { ...s.project, boqOverrides } };
                }),
                resetBoqSection: (keys) => edit(s => {
                    const drop = new Set(keys);
                    const boqOverrides = Object.fromEntries(
                        Object.entries(s.project.boqOverrides).filter(([k]) => !drop.has(k)),
                    );
                    return { project: { ...s.project, boqOverrides } };
                }),
                setCalculatorInput: (id, input) => edit(s => {
                    const others = Object.entries(s.project.calculators).filter(([k]) => k !== id);
                    const calculators = Object.fromEntries(input === undefined ? others : [...others, [id, input]]);
                    return { project: { ...s.project, calculators } };
                }),
                setPlanning: (patch) => edit(s => {
                    const merged: Record<string, unknown> = { ...s.project.planning, ...patch };
                    const planning = Object.fromEntries(
                        Object.entries(merged).filter(([, v]) => v !== undefined),
                    ) as Partial<PlanningInput>;
                    return { project: { ...s.project, planning } };
                }),
                setLevelMark: (levelId, mark) => edit(s => {
                    const others = Object.entries(s.project.journey ?? {}).filter(([k]) => k !== levelId);
                    const journey = Object.fromEntries(mark === undefined ? others : [...others, [levelId, mark]]);
                    return { project: { ...s.project, journey } };
                }),
                newProject: (start) => startOver(start),
                resetProject: () => startOver(undefined),

                binding: GUEST,
                guestProject: null,
                openCloudProject: (binding, project) => {
                    writesSuspended = true;
                    set(s => ({
                        binding: { kind: 'cloud', ...binding },
                        project,
                        // Switching from one cloud project to another keeps the guest project that was set aside first.
                        guestProject: s.binding.kind === 'guest' ? s.project : s.guestProject,
                    }));
                },
                closeCloudProject: () => {
                    const s = get();
                    if (s.binding.kind === 'guest') return;
                    writesSuspended = false;
                    set({ binding: GUEST, project: readSavedGuestProject() ?? s.guestProject ?? createProject(), guestProject: null });
                },
                replaceProject: (project) => set({ project }),
                setCloudRole: (role) => set(s => (s.binding.kind === 'cloud' ? { binding: { ...s.binding, role } } : {})),
            };
        },
        {
            // New key: data saved by the pre-rebuild model (key "boq-storage") is not migrated (decision D7).
            name: GUEST_PROJECT_KEY,
            version: PROJECT_SCHEMA_VERSION,
            storage: createJSONStorage(() => {
                if (typeof localStorage === 'undefined') throw new Error('no localStorage');
                return guestStorage;
            }),
            // Only the guest project is ever saved here (writes are skipped while a cloud project is open).
            partialize: (s) => ({ project: selectGuestProject(s) }),
            // A version newer than this app knows (saved by a later build) cannot be read: start fresh.
            migrate: (persisted, version) => (version > PROJECT_SCHEMA_VERSION ? {} : persisted) as { project: Project },
            // Restoring from storage only ever touches the guest project.
            merge: (persisted, current) => {
                const stored = (persisted as { project?: unknown } | undefined)?.project;
                if (!isRecord(stored)) return current;
                // Hand-edited storage may lack whole parts: the ones the engine needs come from a new project.
                const base = createProject('sample');
                const project: Project = {
                    ...base,
                    ...stored,
                    meta: { ...base.meta, ...(isRecord(stored.meta) ? stored.meta : {}) },
                    calculators: isRecord(stored.calculators) ? stored.calculators : {},
                    boqOverrides: isRecord(stored.boqOverrides) ? stored.boqOverrides : {},
                };
                return current.binding.kind === 'guest' ? { ...current, project } : { ...current, guestProject: project };
            },
            // localStorage hydrates synchronously inside create(), before `useProjectStore` exists,
            // so mark hydration through the state handed to the callback. A failed restore (no state) keeps the
            // fresh project and still ends the spinner, once the store exists.
            onRehydrateStorage: () => (state, error) => {
                state?.setHasHydrated();
                if (state === undefined || error !== undefined) queueMicrotask(() => useProjectStore.setState({ hasHydrated: true }));
            },
        },
    ),
);
