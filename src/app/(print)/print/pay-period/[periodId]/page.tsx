'use client';

import { useParams } from 'next/navigation';
import { PaySlipPrint } from '@/features/erp/labour/PaySlipPrint';

export default function PayPeriodPrintRoute() {
    const params = useParams<{ periodId: string }>();
    return <PaySlipPrint periodId={params.periodId} />;
}
