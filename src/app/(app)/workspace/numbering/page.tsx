'use client';

import { ModuleGate } from '@/features/modules/ModuleGate';
import { NumberingSettingsPage } from '@/features/erp/numbering/NumberingSettingsPage';

export default function NumberingRoute() {
    return (
        <ModuleGate module="project-hub" next="/workspace/numbering">
            <NumberingSettingsPage />
        </ModuleGate>
    );
}
