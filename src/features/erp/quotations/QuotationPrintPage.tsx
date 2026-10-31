'use client';

// ─── /print/quotation/[versionId]: the quotation on paper (issued: snapshots of the version; draft: live company / customer) ───
import { useMemo } from 'react';
import { Alert, Skeleton } from 'antd';
import { useTranslations } from 'next-intl';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useCompanyProfile } from '../company/hooks';
import { useCustomer } from '../customers/hooks';
import { PrintFrame } from '../shared/PrintFrame';
import { useQuotation, useQuotationVersion } from './hooks';
import { QuotationPrintDocument } from './QuotationPrintDocument';
import {
    buildQuotationPrintModel, companyFromProfile, companyFromSnapshot, customerFromDto, customerFromSnapshot,
    type PrintCompany, type PrintCustomer,
} from './print-model';

export function QuotationPrintPage({ versionId }: { versionId: string }) {
    const t = useTranslations('quotations');
    const toText = useErrorMessage();
    const version = useQuotationVersion(versionId);
    const v = version.data;
    const quotation = useQuotation(v?.quotationId);
    const company = useCompanyProfile(quotation.data?.workspaceId);
    const customer = useCustomer(v?.customerSnapshot === null ? (v.customerId ?? undefined) : undefined);

    const model = useMemo(() => {
        if (v === undefined) return null;
        // Images are the company's current files (a snapshot keeps only their ids).
        const images = {
            logoUrl: company.data?.logo?.url ?? null,
            stampUrl: company.data?.stamp?.url ?? null,
            signatureUrl: company.data?.signature?.url ?? null,
        };
        let c: PrintCompany | null = null;
        if (v.companySnapshot !== null) c = companyFromSnapshot(v.companySnapshot, images);
        else if (company.data !== undefined) c = companyFromProfile(company.data, v.language);
        if (c === null) return null;
        let cu: PrintCustomer | null = null;
        if (v.customerSnapshot !== null) cu = customerFromSnapshot(v.customerSnapshot);
        else if (customer.data !== undefined) cu = customerFromDto(customer.data, v.language);
        return buildQuotationPrintModel({ version: v, company: c, customer: cu });
    }, [v, company.data, customer.data]);

    if (version.isError) {
        return <div className="p-4"><Alert type="error" showIcon title={t('loadFailed')} description={toText(version.error)} /></div>;
    }
    if (model === null || v === undefined) {
        if (company.isError) return <div className="p-4"><Alert type="error" showIcon title={t('loadFailed')} description={toText(company.error)} /></div>;
        return <div className="p-6"><Skeleton active /></div>;
    }
    return (
        <PrintFrame language={v.language} watermark={model.watermark} title={v.number ?? v.title} ready>
            <QuotationPrintDocument model={model} />
        </PrintFrame>
    );
}
