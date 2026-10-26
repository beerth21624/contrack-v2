'use client';

import { useParams } from 'next/navigation';
import { ModuleGate } from '@/features/modules/ModuleGate';
import { ContractPage } from '@/features/subcontracting/contracts/ContractPage';

export default function SubcontractRoute() {
    const { subcontractId } = useParams<{ subcontractId: string }>();
    return (
        <ModuleGate module="subcontracting" next={`/subcontracting/contracts/${subcontractId}`}>
            <ContractPage key={subcontractId} id={subcontractId} />
        </ModuleGate>
    );
}
