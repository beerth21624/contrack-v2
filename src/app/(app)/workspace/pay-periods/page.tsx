'use client';

import { ModuleGate } from '@/features/modules/ModuleGate';
import { PayPeriodsPage } from '@/features/erp/labour/PayPeriodsPage';

export default function PayPeriodsRoute() {
    return (
        <ModuleGate module="labour" next="/workspace/pay-periods">
            <PayPeriodsPage />
        </ModuleGate>
    );
}
