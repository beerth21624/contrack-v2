'use client';

import { ModuleGate } from '@/features/modules/ModuleGate';
import { ReportPage } from '@/features/subcontracting/contracts/ReportPage';

export default function ReportRoute() {
    return (
        <ModuleGate module="subcontracting" next="/subcontracting/report">
            <ReportPage />
        </ModuleGate>
    );
}
