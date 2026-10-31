'use client';

import { ModuleGate } from '@/features/modules/ModuleGate';
import { ApprovalPoliciesPage } from '@/features/erp/approvals/ApprovalPoliciesPage';

export default function ApprovalPoliciesRoute() {
    return (
        <ModuleGate module="project-hub" next="/workspace/approval-policies">
            <ApprovalPoliciesPage />
        </ModuleGate>
    );
}
