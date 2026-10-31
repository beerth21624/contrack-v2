'use client';

import { useParams } from 'next/navigation';
import { ModuleGate } from '@/features/modules/ModuleGate';
import { VariationsPage } from '@/features/erp/variations/VariationsPage';

export default function ProjectVariationsRoute() {
    const params = useParams<{ projectId: string }>();
    return (
        <ModuleGate module="variations" next={`/p/${encodeURIComponent(params.projectId)}/variations`}>
            <VariationsPage projectId={params.projectId} />
        </ModuleGate>
    );
}
