'use client';

import { useParams } from 'next/navigation';
import { HandoverPrintPage } from '@/features/erp/handover/HandoverPrintPage';

export default function HandoverPrintRoute() {
    const params = useParams<{ handoverId: string }>();
    return <HandoverPrintPage handoverId={params.handoverId} />;
}
