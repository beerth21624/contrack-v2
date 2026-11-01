'use client';

import { useParams } from 'next/navigation';
import { ModuleGate } from '@/features/modules/ModuleGate';
import { LabourPage } from '@/features/erp/labour/LabourPage';

export default function ProjectLabourRoute() {
    const params = useParams<{ projectId: string }>();
    return (
        <ModuleGate module="labour" next={`/p/${encodeURIComponent(params.projectId)}/labour`}>
            <LabourPage projectId={params.projectId} />
        </ModuleGate>
    );
}
