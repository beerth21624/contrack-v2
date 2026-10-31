'use client';

import { ModuleGate } from '@/features/modules/ModuleGate';
import { PortalPage } from '@/features/erp/portal/PortalPage';

export default function HomeRoute() {
    return (
        <ModuleGate module="portal" next="/home">
            <PortalPage />
        </ModuleGate>
    );
}
