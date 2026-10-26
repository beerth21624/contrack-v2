'use client';

import { ModuleGate } from '@/features/modules/ModuleGate';
import { ContractsListPage } from '@/features/subcontracting/contracts/ContractsListPage';

export default function SubcontractsRoute() {
    return (
        <ModuleGate module="subcontracting" next="/subcontracting/contracts">
            <ContractsListPage />
        </ModuleGate>
    );
}
