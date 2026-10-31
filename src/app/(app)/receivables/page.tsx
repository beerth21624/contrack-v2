'use client';

import { ModuleGate } from '@/features/modules/ModuleGate';
import { ReceivablesPage } from '@/features/erp/billing/ReceivablesPage';

export default function ReceivablesRoute() {
    return (
        <ModuleGate module="billing" next="/receivables">
            <ReceivablesPage />
        </ModuleGate>
    );
}
