'use client';

import { useParams } from 'next/navigation';
import { WhtCertificatePrintPage } from '@/features/erp/payables/WhtCertificatePrint';

export default function WhtCertificatePrintRoute() {
    const params = useParams<{ certificateId: string }>();
    return <WhtCertificatePrintPage certificateId={params.certificateId} />;
}
