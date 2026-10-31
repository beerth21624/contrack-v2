'use client';

import { useParams } from 'next/navigation';
import { ModuleGate } from '@/features/modules/ModuleGate';
import { ClaimEditorPage } from '@/features/erp/billing/ClaimEditorPage';

export default function ClaimEditorRoute() {
    const params = useParams<{ projectId: string; claimId: string }>();
    return (
        <ModuleGate module="billing" next={`/p/${encodeURIComponent(params.projectId)}/billing/claims/${encodeURIComponent(params.claimId)}`}>
            <ClaimEditorPage projectId={params.projectId} claimId={params.claimId} />
        </ModuleGate>
    );
}
