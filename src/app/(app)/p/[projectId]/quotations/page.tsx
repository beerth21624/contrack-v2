'use client';

import { useParams } from 'next/navigation';
import { ModuleGate } from '@/features/modules/ModuleGate';
import { QuotationsPage } from '@/features/erp/quotations/QuotationsPage';

export default function ProjectQuotationsRoute() {
    const params = useParams<{ projectId: string }>();
    return (
        <ModuleGate module="quotations" next={`/p/${encodeURIComponent(params.projectId)}/quotations`}>
            <QuotationsPage projectId={params.projectId} />
        </ModuleGate>
    );
}
