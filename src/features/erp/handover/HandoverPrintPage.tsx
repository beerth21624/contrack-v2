'use client';

// ─── /print/handover/[handoverId]?project=<projectId>: the handover note (read through its project; there is no by-id read) ───
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Alert, Skeleton } from 'antd';
import { useTranslations } from 'next-intl';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useContract } from '../contracts/hooks';
import { useContractPrintModel } from '../contracts/useContractPrintModel';
import { useHubProject } from '../hub/hooks';
import { PrintFrame } from '../shared/PrintFrame';
import { HandoverPrintDocument } from './HandoverPrintDocument';
import { useProjectHandover } from './hooks';
import { buildHandoverPrintModel } from './print-model';

function Inner({ handoverId }: { handoverId: string }) {
    const t = useTranslations('handover');
    const toText = useErrorMessage();
    const projectId = useSearchParams().get('project') ?? undefined;
    const q = useProjectHandover(projectId);
    const h = q.data?.handover?.id === handoverId ? q.data.handover : undefined;
    const contract = useContract(h?.contractId);
    const hub = useHubProject(projectId);
    const { model: contractModel, error } = useContractPrintModel(contract.data);

    const err: unknown = q.error ?? contract.error ?? hub.error ?? error;
    if (err !== null && err !== undefined) return <div className="p-4"><Alert type="error" showIcon title={t('loadFailed')} description={toText(err)} /></div>;
    if (projectId === undefined || (q.data !== undefined && h === undefined)) {
        return <div className="p-4"><Alert type="error" showIcon title={t('print.notFound')} /></div>;
    }
    if (h === undefined || contractModel === null || contract.data === undefined || hub.data === undefined) return <div className="p-6"><Skeleton active /></div>;
    const model = buildHandoverPrintModel({
        handover: h, company: contractModel.company, customer: contractModel.customer, projectName: hub.data.project.name,
        contractNumber: contract.data.number, warrantyMonths: q.data?.contract?.warrantyMonths ?? 0,
    });
    return (
        <PrintFrame language={h.language} watermark={model.watermark} title={h.number ?? t('print.draftTitle')} ready>
            <HandoverPrintDocument model={model} />
        </PrintFrame>
    );
}

export function HandoverPrintPage({ handoverId }: { handoverId: string }) {
    return (
        <Suspense fallback={<div className="p-6"><Skeleton active /></div>}>
            <Inner handoverId={handoverId} />
        </Suspense>
    );
}
