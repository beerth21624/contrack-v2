'use client';

import { useParams } from 'next/navigation';
import { QuotationPrintPage } from '@/features/erp/quotations/QuotationPrintPage';

export default function QuotationPrintRoute() {
    const params = useParams<{ versionId: string }>();
    return <QuotationPrintPage versionId={params.versionId} />;
}
