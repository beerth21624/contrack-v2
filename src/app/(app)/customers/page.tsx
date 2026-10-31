'use client';

import { ModuleGate } from '@/features/modules/ModuleGate';
import { CustomersPage } from '@/features/erp/customers/CustomersPage';

export default function CustomersRoute() {
    return (
        <ModuleGate module="project-hub" next="/customers">
            <CustomersPage />
        </ModuleGate>
    );
}
