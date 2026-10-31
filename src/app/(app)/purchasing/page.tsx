'use client';

import { ModuleGate } from '@/features/modules/ModuleGate';
import { PurchasingPage } from '@/features/erp/procurement/PurchasingPage';

export default function PurchasingRoute() {
    return (
        <ModuleGate module="procurement" next="/purchasing">
            <PurchasingPage />
        </ModuleGate>
    );
}
