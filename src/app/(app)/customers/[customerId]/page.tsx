'use client';

import { useParams } from 'next/navigation';
import { ModuleGate } from '@/features/modules/ModuleGate';
import { CustomerDetailPage } from '@/features/erp/customers/CustomerDetailPage';

export default function CustomerDetailRoute() {
    const params = useParams<{ customerId: string }>();
    return (
        <ModuleGate module="project-hub" next={`/customers/${encodeURIComponent(params.customerId)}`}>
            <CustomerDetailPage customerId={params.customerId} />
        </ModuleGate>
    );
}
