'use client';

import { useParams } from 'next/navigation';
import { ModuleGate } from '@/features/modules/ModuleGate';
import { BillingPage } from '@/features/erp/billing/BillingPage';

export default function ProjectBillingRoute() {
    const params = useParams<{ projectId: string }>();
    return (
        <ModuleGate module="billing" next={`/p/${encodeURIComponent(params.projectId)}/billing`}>
            <BillingPage projectId={params.projectId} />
        </ModuleGate>
    );
}
