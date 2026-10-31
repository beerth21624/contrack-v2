'use client';

import { useParams } from 'next/navigation';
import { ClaimPrintPage } from '@/features/erp/billing/PrintPages';

export default function ClaimPrintRoute() {
    const params = useParams<{ claimId: string }>();
    return <ClaimPrintPage claimId={params.claimId} />;
}
