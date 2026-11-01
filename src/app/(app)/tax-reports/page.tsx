'use client';

import { ModuleGate } from '@/features/modules/ModuleGate';
import { TaxReportsPage } from '@/features/erp/tax-reports/TaxReportsPage';

export default function TaxReportsRoute() {
    return (
        <ModuleGate module="payables" next="/tax-reports">
            <TaxReportsPage />
        </ModuleGate>
    );
}
