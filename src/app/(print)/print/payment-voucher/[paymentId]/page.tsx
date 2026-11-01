'use client';

import { useParams } from 'next/navigation';
import { PaymentVoucherPrintPage } from '@/features/erp/payables/PaymentVoucherPrint';

export default function PaymentVoucherPrintRoute() {
    const params = useParams<{ paymentId: string }>();
    return <PaymentVoucherPrintPage paymentId={params.paymentId} />;
}
