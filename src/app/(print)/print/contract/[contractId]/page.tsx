'use client';

import { useParams } from 'next/navigation';
import { ContractPrintPage } from '@/features/erp/contracts/ContractPrintPage';

export default function ContractPrintRoute() {
    const params = useParams<{ contractId: string }>();
    return <ContractPrintPage contractId={params.contractId} />;
}
