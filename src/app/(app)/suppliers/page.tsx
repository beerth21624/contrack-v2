'use client';

import { ModuleGate } from '@/features/modules/ModuleGate';
import { SuppliersPage } from '@/features/erp/suppliers/SuppliersPage';

export default function SuppliersRoute() {
    return (
        <ModuleGate module="procurement" next="/suppliers">
            <SuppliersPage />
        </ModuleGate>
    );
}
