'use client';

// ─── Everything the cloud side runs in the background: session start, notices, realtime, role changes ───
// Rendered once inside the app shell (needs antd's App context for messages). Renders nothing.
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { App } from 'antd';
import { useQueryClient } from '@tanstack/react-query';
import { readLocaleCookie, writeLocaleCookie } from '@/i18n/locale-cookie';
import { onNotice } from '@/store/notices';
import { useProjectStore } from '@/store/project-store';
import { bootstrapSession, useSession } from './auth/session';
import { closeCloudProject, resumeRememberedProject } from './projects/controller';
import { useMe } from './query/hooks';
import { useRealtime } from './realtime/useRealtime';

export function CloudRuntime() {
    const { message } = App.useApp();
    const qc = useQueryClient();
    const status = useSession(s => s.status);
    const userId = useSession(s => s.user?.id ?? null);
    const binding = useProjectStore(s => s.binding);
    const me = useMe();
    const router = useRouter();
    const prevUser = useRef<string | null>(null);
    const profileLocale = me.data?.locale;

    useEffect(() => { void bootstrapSession(); }, []);

    useEffect(() => onNotice(n => {
        void message.open({ type: n.level, content: n.text, key: n.key, duration: n.level === 'error' || n.level === 'warning' ? 6 : 3 });
    }), [message]);

    // Signed in (start, login, other user): reopen the cloud project of this tab. Signed out: back to the guest project.
    useEffect(() => {
        if (status === 'signed-in' && userId !== prevUser.current) {
            if (prevUser.current !== null) qc.clear();
            prevUser.current = userId;
            void resumeRememberedProject(qc);
        }
        if (status === 'guest') {
            const wasSignedIn = prevUser.current !== null;
            prevUser.current = null;
            if (useProjectStore.getState().binding.kind === 'cloud') {
                void closeCloudProject().then(() => {
                    if (wasSignedIn) void message.info('ออกจากระบบแล้ว — กลับมาใช้โครงการในเครื่องนี้');
                });
            }
            qc.clear();
        }
    }, [status, userId, qc, message]);

    // Someone changed my role (or removed me) in the open project's workspace.
    useEffect(() => {
        if (binding.kind !== 'cloud' || !me.data) return;
        const ws = me.data.workspaces.find(w => w.id === binding.workspaceId);
        if (!ws) {
            void closeCloudProject().then(() => { void message.warning('คุณไม่ได้เป็นสมาชิกของพื้นที่ทำงานนี้แล้ว'); });
            return;
        }
        if (ws.role !== binding.role) useProjectStore.getState().setCloudRole(ws.role);
    }, [binding, me.data, message]);

    // The profile language wins over this browser's cookie (signed in on another device, or switched there).
    // A server without users.locale answers no locale: nothing changes. Release 1: every profile is Thai = no cookie.
    useEffect(() => {
        if (profileLocale === undefined || profileLocale === readLocaleCookie()) return;
        writeLocaleCookie(profileLocale);
        router.refresh();
    }, [profileLocale, router]);

    useRealtime();
    return null;
}
