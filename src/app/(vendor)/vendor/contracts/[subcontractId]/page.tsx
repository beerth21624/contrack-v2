'use client';

import { useParams } from 'next/navigation';
import { ContractPage } from '@/features/vendor/pages/ContractPage';

export default function VendorContractRoute() {
    const params = useParams<{ subcontractId: string }>();
    return <ContractPage id={params.subcontractId} />;
}
