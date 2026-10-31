'use client';

import { useParams } from 'next/navigation';
import { VariationPrintPage } from '@/features/erp/variations/VariationPrintPage';

export default function VariationPrintRoute() {
    const params = useParams<{ variationId: string }>();
    return <VariationPrintPage variationId={params.variationId} />;
}
