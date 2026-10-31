'use client';

// ─── /print/purchase-order/[orderId]: the PO on paper (company: the live profile; supplier: the snapshot once issued) ───
import { useMemo } from 'react';
import { Alert, Skeleton } from 'antd';
import { useTranslations } from 'next-intl';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useCompanyProfile } from '../company/hooks';
import { useHubProject } from '../hub/hooks';
import { companyFromProfile } from '../quotations/print-model';
import { PrintFrame } from '../shared/PrintFrame';
import { useSupplier } from '../suppliers/hooks';
import { usePurchaseOrder } from './hooks';
import { buildPurchaseOrderPrintModel } from './print-model';
import { PurchaseOrderPrintDocument } from './PurchaseOrderPrintDocument';

export function PurchaseOrderPrintPage({ orderId }: { orderId: string }) {
    const t = useTranslations('procurement.order');
    const toText = useErrorMessage();
    const order = usePurchaseOrder(orderId);
    const o = order.data;
    const hub = useHubProject(o?.projectId);
    const company = useCompanyProfile(hub.data?.project.workspaceId);
    const supplier = useSupplier(o?.supplierSnapshot === null ? o.supplierId : undefined);

    const model = useMemo(() => {
        if (o === undefined || hub.data === undefined || company.data === undefined) return null;
        if (o.supplierSnapshot === null && supplier.data === undefined) return null;
        return buildPurchaseOrderPrintModel({
            order: o, company: companyFromProfile(company.data, o.language), supplier: supplier.data, projectName: hub.data.project.name,
        });
    }, [o, hub.data, company.data, supplier.data]);

    const error = order.error ?? hub.error ?? company.error ?? supplier.error;
    if (error !== null) return <div className="p-4"><Alert type="error" showIcon title={t('loadFailed')} description={toText(error)} /></div>;
    if (model === null || o === undefined) return <div className="p-6"><Skeleton active /></div>;
    return (
        <PrintFrame language={o.language} watermark={model.watermark} title={o.number ?? t('title')} ready>
            <PurchaseOrderPrintDocument model={model} />
        </PrintFrame>
    );
}
