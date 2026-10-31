'use client';

import { useParams } from 'next/navigation';
import { PurchaseOrderPrintPage } from '@/features/erp/procurement/PurchaseOrderPrintPage';

export default function PurchaseOrderPrintRoute() {
    const params = useParams<{ orderId: string }>();
    return <PurchaseOrderPrintPage orderId={params.orderId} />;
}
