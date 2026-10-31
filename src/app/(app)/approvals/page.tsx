'use client';

import { ModuleGate } from '@/features/modules/ModuleGate';
import { ApprovalsInboxPage } from '@/features/erp/approvals/ApprovalsInboxPage';

export default function ApprovalsRoute() {
    return (
        <ModuleGate module="project-hub" next="/approvals">
            <ApprovalsInboxPage />
        </ModuleGate>
    );
}
