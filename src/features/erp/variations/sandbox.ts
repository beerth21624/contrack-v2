'use client';

// ─── VO pricing sandbox (WP-34): the existing calculators / BOQ work on the baseline snapshot + the VO's sandbox ───
// Entering: the open cloud project stops syncing (it stays remembered for a reload), the baseline snapshot of the
// project with the VO's sandbox laid over it becomes the working copy (binding `sandbox`: never persisted, never
// synced). Saving: the difference from the baseline goes to `POST /variations/:id/compute {sandbox}` (stores the
// sandbox and replaces the calculator lines). Leaving: the cloud project that was open comes back (else the guest one).
// A reload while in the sandbox re-enters it from what the VO has stored (unsaved edits are lost, nothing is written).
import type { QueryClient } from '@tanstack/react-query';
import { createProject, type Project } from '@/domain/project';
import { applyVariationSandbox } from '@/domain/variations/sandbox';
import type { VariationOrderDto, VariationSandbox } from '@/shared/contract';
import { api } from '@/features/cloud/api/routes';
import { openCloudProject, suspendCloudProject } from '@/features/cloud/projects/controller';
import { useProjectStore, type SandboxBinding } from '@/store/project-store';
import { boqControlApi } from '../boq-control/api';
import { variationsApi } from './api';
import { variationKeys } from './hooks';

/** sessionStorage: the sandbox of this tab, re-entered after a reload. */
const SANDBOX_KEY = 'contrack-vo-sandbox';

type Marker = Omit<SandboxBinding, 'kind'>;

function writeMarker(m: Marker | null): void {
    try {
        if (m === null) sessionStorage.removeItem(SANDBOX_KEY);
        else sessionStorage.setItem(SANDBOX_KEY, JSON.stringify(m));
    } catch {
        // no sessionStorage: a reload leaves the sandbox
    }
}

function readMarker(): Marker | null {
    try {
        const raw = sessionStorage.getItem(SANDBOX_KEY);
        if (raw === null) return null;
        const m = JSON.parse(raw) as Partial<Marker>;
        if (typeof m.variationId !== 'string' || typeof m.projectId !== 'string' || typeof m.workspaceId !== 'string') return null;
        return {
            variationId: m.variationId, projectId: m.projectId, workspaceId: m.workspaceId,
            label: typeof m.label === 'string' ? m.label : '',
            returnProjectId: typeof m.returnProjectId === 'string' ? m.returnProjectId : null,
        };
    } catch {
        return null;
    }
}

/** The baseline snapshot of the open sandbox (to diff against on save). */
let baselineOfSandbox: { variationId: string; project: Project } | null = null;

// The sandbox left by any other way (another project opened, signed out): forget it for reloads too.
if (typeof window !== 'undefined') {
    useProjectStore.subscribe((s, prev) => {
        if (prev.binding.kind === 'sandbox' && s.binding.kind !== 'sandbox') {
            baselineOfSandbox = null;
            writeMarker(null);
        }
    });
}

const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

function normalize(snapshot: unknown): Project {
    const s = isRecord(snapshot) ? (snapshot as Partial<Project>) : {};
    const base = createProject(s.start ?? 'sample');
    return {
        ...base,
        ...s,
        meta: { ...base.meta, ...(isRecord(s.meta) ? s.meta : {}) },
        calculators: isRecord(s.calculators) ? s.calculators : {},
        boqOverrides: isRecord(s.boqOverrides) ? s.boqOverrides : {},
    };
}

export type SandboxProblem = 'baseline_not_locked' | 'not_draft';

/** The project as locked by the baseline (the revision snapshot of the baseline version), or null when not locked. */
async function loadBaselineProject(projectId: string): Promise<Project | null> {
    const status = await boqControlApi.baseline(projectId);
    if (!status.locked || status.baseline === null) return null;
    const version = await boqControlApi.get(status.baseline.versionId);
    const revision = await api.projects.revision(projectId, version.version.revisionId);
    return normalize(revision.snapshot);
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * What the working copy changes against the baseline: calculators whose input differs, BOQ edits that differ (an edit
 * the baseline had and the copy dropped → `{}`, no edit). A calculator reset to the sample cannot be expressed: it is
 * left out (the baseline's input stays).
 */
export function sandboxFromProject(baseline: Project, project: Project): VariationSandbox {
    const calculators: Record<string, unknown> = {};
    for (const [id, input] of Object.entries(project.calculators)) {
        if (input !== undefined && !same(input, baseline.calculators[id])) calculators[id] = input;
    }
    const boqOverrides: Record<string, Record<string, unknown>> = {};
    for (const [key, o] of Object.entries(project.boqOverrides)) {
        if (!same(o, baseline.boqOverrides[key])) boqOverrides[key] = { ...o };
    }
    for (const key of Object.keys(baseline.boqOverrides)) {
        if (!(key in project.boqOverrides)) boqOverrides[key] = {};
    }
    return { calculators, boqOverrides };
}

function returnTarget(): string | null {
    const b = useProjectStore.getState().binding;
    if (b.kind === 'cloud') return b.projectId;
    if (b.kind === 'sandbox') return b.returnProjectId;
    return null;
}

async function open(vo: VariationOrderDto, workspaceId: string, returnProjectId: string | null): Promise<SandboxProblem | null> {
    if (vo.status !== 'draft') return 'not_draft';
    const baseline = await loadBaselineProject(vo.projectId);
    if (baseline === null) return 'baseline_not_locked';
    if (useProjectStore.getState().binding.kind === 'cloud') await suspendCloudProject();
    const marker: Marker = { variationId: vo.id, projectId: vo.projectId, workspaceId, label: vo.number ?? vo.title, returnProjectId };
    baselineOfSandbox = { variationId: vo.id, project: baseline };
    useProjectStore.getState().openSandbox(marker, applyVariationSandbox(baseline, vo.sandbox));
    writeMarker(marker);
    return null;
}

/** Opens the VO's sandbox as the working copy; returns why it cannot (null = opened). Throws ApiError on a failed request. */
export async function enterVariationSandbox(vo: VariationOrderDto, workspaceId: string): Promise<SandboxProblem | null> {
    return open(vo, workspaceId, returnTarget());
}

/** Back to the project that was open before the sandbox (the cloud one, else the guest one). */
export async function leaveVariationSandbox(qc: QueryClient): Promise<void> {
    const b = useProjectStore.getState().binding;
    if (b.kind !== 'sandbox') return;
    baselineOfSandbox = null;
    writeMarker(null);
    useProjectStore.getState().closeCloudProject();
    if (b.returnProjectId !== null) {
        try {
            await openCloudProject(qc, b.returnProjectId);
        } catch (e) {
            console.warn('could not reopen the cloud project after the sandbox', e);
        }
    }
}

/** Saves the sandbox to the VO (calculator lines recomputed by the server); the sandbox stays open. */
export async function saveVariationSandbox(qc: QueryClient): Promise<VariationOrderDto> {
    const s = useProjectStore.getState();
    const b = s.binding;
    if (b.kind !== 'sandbox' || baselineOfSandbox?.variationId !== b.variationId) throw new Error('no sandbox open');
    const sandbox = sandboxFromProject(baselineOfSandbox.project, s.project);
    const vo = await variationsApi.compute(b.variationId, { sandbox });
    qc.setQueryData(variationKeys.one(vo.id), vo);
    void qc.invalidateQueries({ queryKey: variationKeys.list(vo.projectId) });
    return vo;
}

/** After a reload: re-enter the sandbox this tab had open (from the VO's stored sandbox). Returns whether it did. */
export async function resumeVariationSandbox(qc: QueryClient): Promise<boolean> {
    const marker = readMarker();
    if (marker === null) return false;
    try {
        const vo = await qc.query({ queryKey: variationKeys.one(marker.variationId), queryFn: () => variationsApi.get(marker.variationId), staleTime: 0 });
        const problem = await open(vo, marker.workspaceId, marker.returnProjectId);
        if (problem === null) return true;
    } catch (e) {
        console.warn('could not reopen the VO sandbox', e);
    }
    writeMarker(null);
    return false;
}

/** Signed out: the sandbox (and its reload marker) is dropped. */
export function forgetVariationSandbox(): void {
    baselineOfSandbox = null;
    writeMarker(null);
}
