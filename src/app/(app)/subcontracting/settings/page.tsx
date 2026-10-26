'use client';

import { ModuleGate } from '@/features/modules/ModuleGate';
import { SettingsPage } from '@/features/subcontracting/contracts/SettingsPage';

export default function SubcontractingSettingsRoute() {
    return (
        <ModuleGate module="subcontracting" next="/subcontracting/settings">
            <SettingsPage />
        </ModuleGate>
    );
}
