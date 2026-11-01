'use client';

import { useParams } from 'next/navigation';
import { ModuleGate } from '@/features/modules/ModuleGate';
import { PayPeriodDetail } from '@/features/erp/labour/PayPeriodDetail';

export default function PayPeriodDetailRoute() {
    const params = useParams<{ periodKey: string }>();
    return (
        <ModuleGate module="labour" next={`/workspace/pay-periods/${encodeURIComponent(params.periodKey)}`}>
            <PayPeriodDetail periodKey={params.periodKey} />
        </ModuleGate>
    );
}
