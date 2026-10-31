'use client';

import { useParams } from 'next/navigation';
import { ModuleGate } from '@/features/modules/ModuleGate';
import { PurchaseOrderPage } from '@/features/erp/procurement/PurchaseOrderPage';

export default function PurchaseOrderRoute() {
    const params = useParams<{ projectId: string; orderId: string }>();
    return (
        <ModuleGate module="procurement" next={`/p/${encodeURIComponent(params.projectId)}/procurement/orders/${encodeURIComponent(params.orderId)}`}>
            <PurchaseOrderPage projectId={params.projectId} orderId={params.orderId} />
        </ModuleGate>
    );
}
