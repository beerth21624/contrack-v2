'use client';

import { useParams } from 'next/navigation';
import { RfqPrintPage } from '@/features/erp/procurement/RfqPrintPage';

export default function RfqPrintRoute() {
    const params = useParams<{ rfqId: string }>();
    return <RfqPrintPage rfqId={params.rfqId} />;
}
