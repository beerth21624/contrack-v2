'use client';

import { useParams } from 'next/navigation';
import { ReceiptPrintPage } from '@/features/erp/billing/PrintPages';

export default function ReceiptPrintRoute() {
    const params = useParams<{ receiptId: string }>();
    return <ReceiptPrintPage receiptId={params.receiptId} />;
}
