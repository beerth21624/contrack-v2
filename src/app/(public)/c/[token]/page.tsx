'use client';

import { useParams } from 'next/navigation';
// Owner modules register their renderers (side effect of the import).
import '@/features/erp/quotations/QuotationCustomerView';
import '@/features/erp/billing/InvoiceCustomerView';
import { PublicLinkPage } from '@/features/erp/customer-links/PublicLinkPage';

export default function PublicLinkRoute() {
    const params = useParams<{ token: string }>();
    return <PublicLinkPage token={params.token} />;
}
