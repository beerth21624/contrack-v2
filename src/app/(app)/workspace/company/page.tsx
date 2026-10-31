'use client';

import { ModuleGate } from '@/features/modules/ModuleGate';
import { CompanyProfilePage } from '@/features/erp/company/CompanyProfilePage';

export default function CompanyRoute() {
    return (
        <ModuleGate module="project-hub" next="/workspace/company">
            <CompanyProfilePage />
        </ModuleGate>
    );
}
