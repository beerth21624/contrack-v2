'use client';

import { useParams } from 'next/navigation';
import { ModuleGate } from '@/features/modules/ModuleGate';
import { SupplierDetailPage } from '@/features/erp/suppliers/SupplierDetailPage';

export default function SupplierDetailRoute() {
    const params = useParams<{ supplierId: string }>();
    return (
        <ModuleGate module="procurement" next={`/suppliers/${encodeURIComponent(params.supplierId)}`}>
            <SupplierDetailPage supplierId={params.supplierId} />
        </ModuleGate>
    );
}
