'use client';

import { ModuleGate } from '@/features/modules/ModuleGate';
import { PayablesPage } from '@/features/erp/payables/PayablesPage';

export default function PayablesRoute() {
    return (
        <ModuleGate module="payables" next="/payables">
            <PayablesPage />
        </ModuleGate>
    );
}
