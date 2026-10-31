'use client';

// ─── `/`: where the app starts (docs/erp/01-architecture.md §3.2) ───
// (1) the platform does not offer project-hub → /journey at once (release 1, no sign-in needed); (2) guest → /journey;
// (3) portal active → /home; (4) project-hub active → /hub; (5) otherwise /journey. Only a spinner while deciding.
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Spin } from 'antd';
import { bootstrapSession, useSession } from '@/features/cloud/auth/session';
import { useCurrentWorkspace } from '@/features/cloud/query/hooks';
import { usePlatformModules, useWorkspaceModules } from '@/features/modules/modules';

function useHomeTarget(): string | undefined {
    const platform = usePlatformModules();
    const offered = platform.data?.includes('project-hub') === true;
    const status = useSession(s => s.status);
    const { workspace, isLoading: workspacesLoading } = useCurrentWorkspace();
    const modules = useWorkspaceModules(offered ? workspace?.id : undefined);

    useEffect(() => { if (offered) void bootstrapSession(); }, [offered]);

    if (platform.isError) return '/journey';
    if (platform.data === undefined) return undefined;
    if (!offered) return '/journey';
    if (status === 'unknown') return undefined;
    if (status === 'guest') return '/journey';
    if (workspacesLoading) return undefined;
    if (workspace === undefined) return '/journey';
    if (modules.isError) return '/journey';
    if (modules.data === undefined) return undefined;
    const active = (id: string) => modules.data.some(m => m.module === id && m.active);
    if (active('portal')) return '/home';
    if (active('project-hub')) return '/hub';
    return '/journey';
}

export function HomeRedirect() {
    const router = useRouter();
    const target = useHomeTarget();
    const done = useRef(false);
    useEffect(() => {
        if (target === undefined || done.current) return;
        done.current = true;
        router.replace(target);
    }, [target, router]);
    return (
        <div className="flex min-h-dvh items-center justify-center">
            <Spin size="large" />
        </div>
    );
}
