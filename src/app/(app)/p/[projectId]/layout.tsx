'use client';

import { useParams } from 'next/navigation';
import { ModuleGate } from '@/features/modules/ModuleGate';
import { ProjectShell } from '@/features/erp/hub/ProjectShell';

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
    const params = useParams<{ projectId: string }>();
    return (
        <ModuleGate module="project-hub" next={`/p/${encodeURIComponent(params.projectId)}`}>
            <ProjectShell projectId={params.projectId}>{children}</ProjectShell>
        </ModuleGate>
    );
}
