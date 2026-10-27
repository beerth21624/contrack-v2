'use client';

// ─── React glue of the realtime connection: open while a cloud project is the working copy ───
import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { getLevel } from '@/domain/journey';
import { useProjectStore } from '@/store/project-store';
import { emitNotice } from '@/store/notices';
import { levelIdSchema, type LevelAssignmentDto } from '@/shared/contract';
import { apiClient } from '../api/client';
import { useSession } from '../auth/session';
import { projectChanged } from '../projects/cache';
import { forgetDeletedProject } from '../projects/controller';
import { qk } from '../query/keys';
import { setAssignmentInCache } from '../query/hooks';
import { useCloud } from '../state';
import { RealtimeConnection, loadRealtimeUrl } from './connection';

/** The journey level of a path (`/journey/<level>`), else null. */
export function levelIdFromPath(pathname: string | null): string | null {
    const m = /^\/journey\/([^/?#]+)/.exec(pathname ?? '');
    const id = m?.[1];
    if (id === undefined || !levelIdSchema.safeParse(id).success || !getLevel(id)) return null;
    return id;
}

export function useRealtime(): void {
    const qc = useQueryClient();
    const userId = useSession(s => (s.status === 'signed-in' ? s.user?.id ?? null : null));
    const projectId = useProjectStore(s => (s.binding.kind === 'cloud' ? s.binding.projectId : null));
    const pathname = usePathname();
    const router = useRouter();
    const conn = useRef<RealtimeConnection | null>(null);
    const active = userId !== null && projectId !== null;

    // The latest room and level, for a connection that opens after they changed (its address is read first).
    const latest = useRef<{ projectId: string | null; levelId: string | null }>({ projectId: null, levelId: null });
    useEffect(() => {
        latest.current = { projectId: active ? projectId : null, levelId: levelIdFromPath(pathname) };
    }, [active, projectId, pathname]);

    // One connection per signed-in user while a cloud project is open.
    useEffect(() => {
        if (!active) return undefined;
        let c: RealtimeConnection | null = null;
        let cancelled = false;
        const connect = (url: string) => new RealtimeConnection({
            url,
            getToken: () => apiClient.accessToken,
            refreshToken: async () => (await apiClient.refresh())?.accessToken ?? null,
            handlers: {
                onDoc: (e) => { useCloud.getState().engine?.applyRemoteDoc(e.doc); },
                onProject: (e) => {
                    const open = useCloud.getState().project;
                    if (open?.id === e.project.id && open.archivedAt === null && e.project.archivedAt !== null) {
                        emitNotice({ level: 'warning', key: 'archived', text: 'โครงการนี้ถูกเก็บถาวรแล้ว แก้ไขเพิ่มไม่ได้' });
                    }
                    projectChanged(qc, e.project);
                },
                onProjectDeleted: (e) => {
                    const workspaceId = useCloud.getState().project?.workspaceId;
                    qc.removeQueries({ queryKey: qk.project(e.projectId) });
                    if (workspaceId !== undefined) void qc.invalidateQueries({ queryKey: qk.projectLists(workspaceId) });
                    void forgetDeletedProject(e.projectId).then(wasOpen => {
                        if (!wasOpen) return;
                        emitNotice({ level: 'warning', key: 'deleted', text: 'โครงการนี้ถูกลบแล้ว — กลับมาใช้โครงการในเครื่องนี้ (การแก้ที่ยังไม่ได้ส่งถูกยกเลิก)' });
                        router.push('/projects');
                    });
                },
                onPresence: (e) => { useCloud.setState({ presence: e.users }); },
                onAssignment: (e) => {
                    qc.setQueryData<LevelAssignmentDto[]>(qk.assignments(e.projectId), old => setAssignmentInCache(old, e.levelId, e.assignment));
                },
            },
        });
        void loadRealtimeUrl().then(url => {
            if (cancelled) return;
            const opened = connect(url);
            c = opened;
            conn.current = opened;
            opened.join(latest.current.projectId);
            opened.setLevel(latest.current.levelId);
        });
        return () => {
            cancelled = true;
            c?.close();
            conn.current = null;
            useCloud.setState({ presence: [] });
        };
    }, [active, userId, qc, router]);

    useEffect(() => {
        conn.current?.join(active ? projectId : null);
    }, [active, projectId]);

    useEffect(() => {
        conn.current?.setLevel(levelIdFromPath(pathname));
    }, [pathname, active, projectId]);
}
