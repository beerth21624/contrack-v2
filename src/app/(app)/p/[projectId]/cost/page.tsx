'use client';

import { useParams } from 'next/navigation';
import { ModuleGate } from '@/features/modules/ModuleGate';
import { JobCostPage } from '@/features/erp/job-cost/JobCostPage';

export default function ProjectCostRoute() {
    const params = useParams<{ projectId: string }>();
    return (
        <ModuleGate module="job-cost" next={`/p/${encodeURIComponent(params.projectId)}/cost`}>
            <JobCostPage projectId={params.projectId} />
        </ModuleGate>
    );
}
