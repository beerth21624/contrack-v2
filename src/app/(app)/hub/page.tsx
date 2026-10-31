'use client';

import { ModuleGate } from '@/features/modules/ModuleGate';
import { HubPage } from '@/features/erp/hub/HubPage';

export default function HubRoute() {
    return (
        <ModuleGate module="project-hub" next="/hub">
            <HubPage />
        </ModuleGate>
    );
}
