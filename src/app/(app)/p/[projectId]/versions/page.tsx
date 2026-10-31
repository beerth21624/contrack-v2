'use client';

import { useParams } from 'next/navigation';
import { ModuleGate } from '@/features/modules/ModuleGate';
import { VersionsPage } from '@/features/erp/boq-control/VersionsPage';

export default function ProjectVersionsRoute() {
    const params = useParams<{ projectId: string }>();
    return (
        <ModuleGate module="boq-control" next={`/p/${encodeURIComponent(params.projectId)}/versions`}>
            <VersionsPage projectId={params.projectId} />
        </ModuleGate>
    );
}
