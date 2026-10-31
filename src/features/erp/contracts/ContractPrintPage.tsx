'use client';

// ─── /print/contract/[contractId]: the contract on paper (signed: snapshots; draft: live company / customer) ───
import { Alert, Skeleton } from 'antd';
import { useTranslations } from 'next-intl';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { PrintFrame } from '../shared/PrintFrame';
import { ContractPrintDocument } from './ContractPrintDocument';
import { useContract } from './hooks';
import { useContractPrintModel } from './useContractPrintModel';

export function ContractPrintPage({ contractId }: { contractId: string }) {
    const t = useTranslations('contracts');
    const toText = useErrorMessage();
    const contract = useContract(contractId);
    const c = contract.data;
    const { model, error } = useContractPrintModel(c);

    if (contract.isError) {
        return <div className="p-4"><Alert type="error" showIcon title={t('loadFailed')} description={toText(contract.error)} /></div>;
    }
    if (model === null || c === undefined) {
        if (error !== null) return <div className="p-4"><Alert type="error" showIcon title={t('loadFailed')} description={toText(error)} /></div>;
        return <div className="p-6"><Skeleton active /></div>;
    }
    return (
        <PrintFrame language={c.language} watermark={model.watermark} title={c.number ?? c.title} ready>
            <ContractPrintDocument model={model} />
        </PrintFrame>
    );
}
