'use client';

import { ModuleGate } from '@/features/modules/ModuleGate';
import { RetentionPage } from '@/features/subcontracting/contracts/RetentionPage';

export default function RetentionRoute() {
    return (
        <ModuleGate module="subcontracting" next="/subcontracting/retention">
            <RetentionPage />
        </ModuleGate>
    );
}
