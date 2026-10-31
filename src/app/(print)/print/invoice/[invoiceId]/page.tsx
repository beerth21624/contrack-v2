'use client';

import { useParams } from 'next/navigation';
import { InvoicePrintPage } from '@/features/erp/billing/PrintPages';

export default function InvoicePrintRoute() {
    const params = useParams<{ invoiceId: string }>();
    return <InvoicePrintPage invoiceId={params.invoiceId} />;
}
