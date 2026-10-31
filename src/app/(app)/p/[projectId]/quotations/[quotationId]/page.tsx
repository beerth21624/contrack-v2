'use client';

import { useParams } from 'next/navigation';
import { ModuleGate } from '@/features/modules/ModuleGate';
import { QuotationEditorPage } from '@/features/erp/quotations/QuotationEditorPage';

export default function ProjectQuotationRoute() {
    const params = useParams<{ projectId: string; quotationId: string }>();
    return (
        <ModuleGate module="quotations" next={`/p/${encodeURIComponent(params.projectId)}/quotations/${encodeURIComponent(params.quotationId)}`}>
            <QuotationEditorPage projectId={params.projectId} quotationId={params.quotationId} />
        </ModuleGate>
    );
}
