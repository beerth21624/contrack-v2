'use client';

import { ModuleGate } from '@/features/modules/ModuleGate';
import { CompanyCashFlowPage } from '@/features/erp/job-cost/CompanyCashFlowPage';

export default function CompanyCashFlowRoute() {
    return (
        <ModuleGate module="job-cost" next="/finance/cashflow">
            <CompanyCashFlowPage />
        </ModuleGate>
    );
}
