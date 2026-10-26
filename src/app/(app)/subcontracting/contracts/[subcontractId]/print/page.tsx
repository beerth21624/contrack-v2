'use client';

import { useParams } from 'next/navigation';
import { ModuleGate } from '@/features/modules/ModuleGate';
import { ContractPrintPage } from '@/features/subcontracting/contracts/ContractPrintPage';

export default function SubcontractPrintRoute() {
    const { subcontractId } = useParams<{ subcontractId: string }>();
    return (
        <ModuleGate module="subcontracting" next={`/subcontracting/contracts/${subcontractId}/print`}>
            <ContractPrintPage id={subcontractId} />
        </ModuleGate>
    );
}
