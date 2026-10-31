'use client';

// ─── /print/variation/[variationId]: the VO on paper (company / customer: the contract's snapshots, else live records) ───
import { useMemo } from 'react';
import { Alert, Skeleton } from 'antd';
import { useTranslations } from 'next-intl';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useCompanyProfile } from '../company/hooks';
import { useContract } from '../contracts/hooks';
import { useHubProject } from '../hub/hooks';
import { companyFromProfile, companyFromSnapshot, customerFromSnapshot, type PrintCompany } from '../quotations/print-model';
import { PrintFrame } from '../shared/PrintFrame';
import { useVariation } from './hooks';
import { buildVariationPrintModel } from './print-model';
import { VariationPrintDocument } from './VariationPrintDocument';

export function VariationPrintPage({ variationId }: { variationId: string }) {
    const t = useTranslations('variations');
    const toText = useErrorMessage();
    const variation = useVariation(variationId);
    const v = variation.data;
    const contract = useContract(v?.contractId);
    const hub = useHubProject(v?.projectId);
    const company = useCompanyProfile(hub.data?.project.workspaceId);
    const k = contract.data;

    const model = useMemo(() => {
        if (v === undefined || k === undefined || hub.data === undefined) return null;
        const images = {
            logoUrl: company.data?.logo?.url ?? null,
            stampUrl: company.data?.stamp?.url ?? null,
            signatureUrl: company.data?.signature?.url ?? null,
        };
        let co: PrintCompany | null = null;
        if (k.companySnapshot !== null) co = companyFromSnapshot(k.companySnapshot, images);
        else if (company.data !== undefined) co = companyFromProfile(company.data, v.language);
        if (co === null) return null;
        const snap = v.customerSnapshot ?? k.customerSnapshot;
        return buildVariationPrintModel({
            variation: v, company: co, customer: snap === null ? null : customerFromSnapshot(snap),
            projectName: hub.data.project.name, contractNumber: k.number,
        });
    }, [v, k, hub.data, company.data]);

    const error = variation.error ?? contract.error ?? hub.error ?? company.error;
    if (error !== null) return <div className="p-4"><Alert type="error" showIcon title={t('loadFailed')} description={toText(error)} /></div>;
    if (model === null || v === undefined) return <div className="p-6"><Skeleton active /></div>;
    return (
        <PrintFrame language={v.language} watermark={model.watermark} title={v.number ?? v.title} ready>
            <VariationPrintDocument model={model} />
        </PrintFrame>
    );
}
