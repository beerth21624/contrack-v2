'use client';

import { useParams } from 'next/navigation';
import { ModuleGate } from '@/features/modules/ModuleGate';
import { PaymentRunPage } from '@/features/erp/payables/PaymentRunPage';

export default function PaymentRunRoute() {
    const params = useParams<{ runId: string }>();
    return (
        <ModuleGate module="payables" next={`/payables/runs/${encodeURIComponent(params.runId)}`}>
            <PaymentRunPage runId={params.runId} />
        </ModuleGate>
    );
}
