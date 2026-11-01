'use client';

import { useParams } from 'next/navigation';
import { ModuleGate } from '@/features/modules/ModuleGate';
import { BillPage } from '@/features/erp/payables/BillEditor';

export default function BillRoute() {
    const params = useParams<{ billId: string }>();
    return (
        <ModuleGate module="payables" next={`/payables/bills/${encodeURIComponent(params.billId)}`}>
            <BillPage billId={params.billId} />
        </ModuleGate>
    );
}
