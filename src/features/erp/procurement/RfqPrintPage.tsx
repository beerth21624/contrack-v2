'use client';

// ─── /print/rfq/[rfqId]?supplier=<id>: the RFQ on paper, addressed to one invited supplier (or left blank) ───
import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Alert, Skeleton } from 'antd';
import { useTranslations } from 'next-intl';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useCompanyProfile } from '../company/hooks';
import { useHubProject } from '../hub/hooks';
import { companyFromProfile } from '../quotations/print-model';
import { PrintFrame } from '../shared/PrintFrame';
import { useSupplier } from '../suppliers/hooks';
import { useRfq } from './hooks';
import { buildRfqPrintModel, supplierFromDto } from './print-model';
import { RfqPrintDocument } from './RfqPrintDocument';

function Inner({ rfqId }: { rfqId: string }) {
    const t = useTranslations('procurement.rfq');
    const toText = useErrorMessage();
    const wanted = useSearchParams().get('supplier');
    const rfq = useRfq(rfqId);
    const r = rfq.data;
    const hub = useHubProject(r?.projectId);
    const company = useCompanyProfile(hub.data?.project.workspaceId);
    const invited = r !== undefined && wanted !== null && r.suppliers.some(s => s.supplierId === wanted) ? wanted : undefined;
    const supplier = useSupplier(invited);

    const model = useMemo(() => {
        if (r === undefined || hub.data === undefined || company.data === undefined) return null;
        if (invited !== undefined && supplier.data === undefined) return null;
        return buildRfqPrintModel({
            rfq: r, company: companyFromProfile(company.data, r.language), projectName: hub.data.project.name,
            supplier: supplier.data === undefined ? null : supplierFromDto(supplier.data, r.language),
        });
    }, [r, hub.data, company.data, supplier.data, invited]);

    const error = rfq.error ?? hub.error ?? company.error ?? supplier.error;
    if (error !== null) return <div className="p-4"><Alert type="error" showIcon title={t('loadFailed')} description={toText(error)} /></div>;
    if (model === null || r === undefined) return <div className="p-6"><Skeleton active /></div>;
    return (
        <PrintFrame language={r.language} watermark={model.watermark} title={r.number ?? t('untitled')} ready>
            <RfqPrintDocument model={model} />
        </PrintFrame>
    );
}

export function RfqPrintPage({ rfqId }: { rfqId: string }) {
    return (
        <Suspense fallback={<div className="p-6"><Skeleton active /></div>}>
            <Inner rfqId={rfqId} />
        </Suspense>
    );
}
