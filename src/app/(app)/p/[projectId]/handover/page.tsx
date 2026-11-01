'use client';

import { useParams } from 'next/navigation';
import { ModuleGate } from '@/features/modules/ModuleGate';
import { HandoverPage } from '@/features/erp/handover/HandoverPage';

export default function ProjectHandoverRoute() {
    const params = useParams<{ projectId: string }>();
    return (
        <ModuleGate module="handover" next={`/p/${encodeURIComponent(params.projectId)}/handover`}>
            <HandoverPage projectId={params.projectId} />
        </ModuleGate>
    );
}
