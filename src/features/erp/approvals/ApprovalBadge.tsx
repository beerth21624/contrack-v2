'use client';

// ─── Number of approval requests waiting for the caller (WP-16 puts it on the menu) ───
import { Badge } from 'antd';
import { useErpWorkspace } from '../shared/useErpWorkspace';
import { useModuleEnabled } from '@/features/modules/modules';
import { usePendingApprovalCount } from './hooks';

/** Wraps `children` (or stands alone) with the count of pending approvals; renders nothing extra when there are none. */
export function ApprovalBadge({ children, workspaceId }: { children?: React.ReactNode; workspaceId?: string }) {
    const ws = useErpWorkspace(workspaceId);
    const on = useModuleEnabled('project-hub', ws.workspaceId).enabled;
    const count = usePendingApprovalCount(ws.workspaceId, on);
    if (!on) return <>{children}</>;
    return <Badge count={count} overflowCount={99} size="small" offset={[6, 0]}>{children}</Badge>;
}
