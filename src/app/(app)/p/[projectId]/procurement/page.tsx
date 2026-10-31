'use client';

import { useParams } from 'next/navigation';
import { ModuleGate } from '@/features/modules/ModuleGate';
import { ProcurementPage } from '@/features/erp/procurement/ProcurementPage';

export default function ProjectProcurementRoute() {
    const params = useParams<{ projectId: string }>();
    return (
        <ModuleGate module="procurement" next={`/p/${encodeURIComponent(params.projectId)}/procurement`}>
            <ProcurementPage projectId={params.projectId} />
        </ModuleGate>
    );
}
