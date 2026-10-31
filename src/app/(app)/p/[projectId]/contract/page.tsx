'use client';

import { useParams } from 'next/navigation';
import { ModuleGate } from '@/features/modules/ModuleGate';
import { ContractPage } from '@/features/erp/contracts/ContractPage';

export default function ProjectContractRoute() {
    const params = useParams<{ projectId: string }>();
    return (
        <ModuleGate module="contracts" next={`/p/${encodeURIComponent(params.projectId)}/contract`}>
            <ContractPage projectId={params.projectId} />
        </ModuleGate>
    );
}
