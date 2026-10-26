'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { BoqLineKey, BoqLineOverride } from '@/domain/boq/types';
import type { PlanningInput } from '@/domain/planning';
import { createProject, PROJECT_SCHEMA_VERSION, type Project, type ProjectMeta, type ProjectStart } from '@/domain/project';
import type { LevelMark } from '@/domain/journey/progress';

/** Field of a BOQ line the user can edit on the BOQ (Home) page. */
export type BoqEditableField = keyof BoqLineOverride;

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
}

export const useProjectStore = create<ProjectState>()(
    persist(
        (set) => ({
            hasHydrated: false,
            setHasHydrated: () => set({ hasHydrated: true }),
            project: createProject(),
            setMeta: (patch) => set(s => ({ project: { ...s.project, meta: { ...s.project.meta, ...patch } } })),
            setBoqOverride: (key, field, value) => set(s => {
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
            resetBoqSection: (keys) => set(s => {
                const drop = new Set(keys);
                const boqOverrides = Object.fromEntries(
                    Object.entries(s.project.boqOverrides).filter(([k]) => !drop.has(k)),
                );
                return { project: { ...s.project, boqOverrides } };
            }),
            setCalculatorInput: (id, input) => set(s => {
                const others = Object.entries(s.project.calculators).filter(([k]) => k !== id);
                const calculators = Object.fromEntries(input === undefined ? others : [...others, [id, input]]);
                return { project: { ...s.project, calculators } };
            }),
            setPlanning: (patch) => set(s => {
                const merged: Record<string, unknown> = { ...s.project.planning, ...patch };
                const planning = Object.fromEntries(
                    Object.entries(merged).filter(([, v]) => v !== undefined),
                ) as Partial<PlanningInput>;
                return { project: { ...s.project, planning } };
            }),
            setLevelMark: (levelId, mark) => set(s => {
                const others = Object.entries(s.project.journey ?? {}).filter(([k]) => k !== levelId);
                const journey = Object.fromEntries(mark === undefined ? others : [...others, [levelId, mark]]);
                return { project: { ...s.project, journey } };
            }),
            newProject: (start) => set({ project: createProject(start) }),
            resetProject: () => set({ project: createProject() }),
        }),
        {
            // New key: data saved by the pre-rebuild model (key "boq-storage") is not migrated (decision D7).
            name: 'contrack-project',
            version: PROJECT_SCHEMA_VERSION,
            storage: createJSONStorage(() => localStorage),
            partialize: (s) => ({ project: s.project }),
            migrate: (persisted) => persisted as { project: Project },
            // localStorage hydrates synchronously inside create(), before `useProjectStore` exists,
            // so mark hydration through the state handed to the callback.
            onRehydrateStorage: () => (state) => { state?.setHasHydrated(); },
        },
    ),
);
