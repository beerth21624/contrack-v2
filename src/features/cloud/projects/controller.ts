// ─── Opening and closing a cloud project as the working copy (store binding + sync engine) ───
import type { QueryClient } from '@tanstack/react-query';
import { docsToProject, isDocKey, type DocEntry } from '@/domain/sync';
import { useProjectStore } from '@/store/project-store';
import { emitNotice } from '@/store/notices';
import { baselineLockedText } from '@/store/baseline-locked-text';
import { boqControlApi } from '@/features/erp/boq-control/api';
import { boqControlKeys } from '@/features/erp/boq-control/hooks';
import { moduleKeys, modulesApi } from '@/features/modules/modules';
import type { ProjectDocDto } from '@/shared/contract';
import { api } from '../api/routes';
import { ApiError, isApiError, thaiErrorMessage } from '../api/errors';
import { qk } from '../query/keys';
import { SAVED_STATUS, useCloud } from '../state';
import { SyncEngine, type SyncEvent } from '../sync/engine';
import { browserNetwork, localQueueStorage, projectStoreAdapter } from '../sync/adapters';
import { projectChanged } from './cache';
import { docLabel } from './doc-label';

/** sessionStorage: the cloud project open in this tab, reopened after a reload (with its saved queue). */
const OPEN_KEY = 'contrack-cloud-open';

function remember(projectId: string | null): void {
    try {
        if (projectId === null) sessionStorage.removeItem(OPEN_KEY);
        else sessionStorage.setItem(OPEN_KEY, projectId);
    } catch {
        // no sessionStorage: nothing is reopened after a reload
    }
}

function remembered(): string | null {
    try {
        return sessionStorage.getItem(OPEN_KEY);
    } catch {
        return null;
    }
}

function toEntries(docs: readonly ProjectDocDto[]): DocEntry[] {
    return docs.flatMap(d => (isDocKey(d.docKey) ? [{ docKey: d.docKey, data: d.data }] : []));
}

function syncEventHandler(queryClient: QueryClient, projectId: string) {
    return (e: SyncEvent) => {
        switch (e.type) {
            case 'saved':
                projectChanged(queryClient, e.project, { refetchLists: false });
                void queryClient.invalidateQueries({ queryKey: qk.activity(projectId) });
                return;
            case 'conflict':
                emitNotice({
                    level: 'warning', key: `conflict:${e.docKey}`,
                    text: `สมาชิกอีกคนแก้ไข ${docLabel(e.docKey)} ไปก่อนแล้ว — ระบบแสดงข้อมูลล่าสุดให้แล้ว กรุณาตรวจสอบก่อนแก้ไขต่อ`,
                });
                return;
            case 'rejected': {
                const label = docLabel(e.docKey);
                const text = isApiError(e.error) && e.error.status === 422
                    ? `${label} มีค่าที่ระบบคำนวณไม่ได้ จึงไม่ได้บันทึก — กลับไปใช้ค่าที่บันทึกไว้ล่าสุด`
                    : `${thaiErrorMessage(e.error)} — ${label} กลับไปใช้ค่าที่บันทึกไว้ล่าสุด`;
                emitNotice({ level: 'error', key: `rejected:${e.docKey}`, text });
                return;
            }
            case 'remote':
                return;
            case 'locked': {
                // Locked from elsewhere (another tab, the contract): read-only from now on, told once.
                const store = useProjectStore.getState();
                if (store.binding.kind === 'cloud' && store.binding.projectId === projectId && store.binding.locked !== true) {
                    store.setCloudLocked(true);
                    emitNotice({ level: 'warning', key: 'baseline-locked', text: baselineLockedText() });
                }
                void queryClient.invalidateQueries({ queryKey: boqControlKeys.baseline(projectId) });
                return;
            }
        }
    };
}

/**
 * Whether the project's BOQ is locked by a baseline. Asked only when `boq-control` is active in the workspace (no
 * request about baselines otherwise); any failure reads as not locked (the server still refuses locked writes).
 */
async function readBaselineLocked(queryClient: QueryClient, workspaceId: string, projectId: string): Promise<boolean> {
    try {
        const offered = await queryClient.query({
            queryKey: moduleKeys.platform, queryFn: async () => (await modulesApi.platform()).modules, staleTime: 5 * 60_000,
        });
        if (!offered.includes('boq-control')) return false;
        const modules = await queryClient.query({
            queryKey: moduleKeys.workspace(workspaceId), queryFn: () => modulesApi.ofWorkspace(workspaceId), staleTime: 60_000,
        });
        if (!modules.some(m => m.module === 'boq-control' && m.active)) return false;
        const status = await queryClient.query({
            queryKey: boqControlKeys.baseline(projectId), queryFn: () => boqControlApi.baseline(projectId), staleTime: 0,
        });
        return status.locked;
    } catch {
        return false;
    }
}

/** Wait (shortly) for edits in flight, then stop the engine. Unsent edits stay queued for the next open. */
async function stopEngine(): Promise<void> {
    const engine = useCloud.getState().engine;
    if (!engine) return;
    engine.flushAll();
    await engine.whenSettled(3_000);
    engine.dispose();
    useCloud.setState({ engine: null, syncStatus: SAVED_STATUS });
}

/**
 * Load a cloud project and make it the working copy: the guest project is set aside (and stays saved in this
 * browser), the sync engine starts and re-sends edits a previous page load could not send.
 */
export async function openCloudProject(queryClient: QueryClient, projectId: string): Promise<void> {
    useCloud.setState({ opening: true });
    try {
        const [detail, me] = await Promise.all([
            queryClient.query({ queryKey: qk.project(projectId), queryFn: () => api.projects.get(projectId), staleTime: 0 }),
            queryClient.query({ queryKey: qk.me, queryFn: () => api.me(), staleTime: 10_000 }),
        ]);
        const workspace = me.workspaces.find(w => w.id === detail.project.workspaceId);
        if (!workspace) throw new ApiError(404, 'not_found', 'not a member of the project workspace');
        const locked = await readBaselineLocked(queryClient, workspace.id, projectId);

        await stopEngine();
        const loaded = docsToProject(detail.project.start, toEntries(detail.docs));
        // No name in the BOQ header yet (no `meta` doc): show the project's name. Not sent as an edit; it is saved
        // with the first real change of the header.
        const project = loaded.meta.projectName.trim() === ''
            ? { ...loaded, meta: { ...loaded.meta, projectName: detail.project.name } }
            : loaded;
        useProjectStore.getState().openCloudProject({ projectId, workspaceId: workspace.id, role: workspace.role, locked }, project);

        const engine = new SyncEngine({
            store: projectStoreAdapter(projectId),
            transport: {
                putDoc: (docKey, body) => api.projects.putDoc(projectId, docKey, body),
                fetchDoc: async (docKey) => (await api.projects.get(projectId)).docs.find(d => d.docKey === docKey) ?? null,
            },
            initialDocs: detail.docs,
            storage: localQueueStorage(projectId),
            network: browserNetwork,
            onEvent: syncEventHandler(queryClient, projectId),
        });
        engine.onStatus(syncStatus => { useCloud.setState({ syncStatus }); });
        useCloud.setState({ engine, project: detail.project, presence: [], syncStatus: engine.getStatus() });
        engine.start();
        remember(projectId);
    } finally {
        useCloud.setState({ opening: false });
    }
}

/**
 * Stop syncing the open cloud project without closing it in the store (a VO sandbox replaces the working copy next).
 * The tab still remembers the project: a reload reopens it.
 */
export async function suspendCloudProject(): Promise<void> {
    await stopEngine();
    useCloud.setState({ project: null, presence: [], syncStatus: SAVED_STATUS });
}

/** Back to the guest project of this browser. */
export async function closeCloudProject(): Promise<void> {
    await stopEngine();
    useProjectStore.getState().closeCloudProject();
    useCloud.setState({ project: null, presence: [], syncStatus: SAVED_STATUS });
    remember(null);
}

/**
 * A project was deleted (here or by someone else): its saved queue is dropped, and when it is the open one the
 * guest project comes back. Returns whether it was the open project.
 */
export async function forgetDeletedProject(projectId: string): Promise<boolean> {
    localQueueStorage(projectId).save({ pending: {} });
    const binding = useProjectStore.getState().binding;
    const isOpen = binding.kind === 'cloud' && binding.projectId === projectId;
    if (!isOpen) return false;
    useCloud.getState().engine?.discard();
    useCloud.setState({ engine: null, syncStatus: SAVED_STATUS });
    await closeCloudProject();
    return true;
}

/** After a reload: reopen the cloud project this tab had open. Fails quietly (back to guest). */
export async function resumeRememberedProject(queryClient: QueryClient): Promise<void> {
    const projectId = remembered();
    if (projectId === null || useProjectStore.getState().binding.kind === 'cloud') return;
    try {
        await openCloudProject(queryClient, projectId);
    } catch (e) {
        if (isApiError(e) && e.isNetwork) return; // offline: try again on the next start
        remember(null);
        console.warn('could not reopen the cloud project', e);
    }
}
