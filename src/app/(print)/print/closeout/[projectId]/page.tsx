'use client';

import { useParams } from 'next/navigation';
import { CloseoutPrintPage } from '@/features/erp/handover/CloseoutPrintPage';

export default function CloseoutPrintRoute() {
    const params = useParams<{ projectId: string }>();
    return <CloseoutPrintPage projectId={params.projectId} />;
}
