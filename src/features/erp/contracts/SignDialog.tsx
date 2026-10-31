'use client';

// ─── Sign a draft contract: number, baseline lock, cost-code prices, project in progress ───
import { useMemo, useState } from 'react';
import { Alert, App, Input, Modal } from 'antd';
import { useTranslations } from 'next-intl';
import type { MainContractDto } from '@/shared/contract';
import { bangkokToday } from '@/domain/dates/business-date';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useBaseline, useCostCodes } from '../boq-control/hooks';
import { useQuotationVersion } from '../quotations/hooks';
import { useSignContract } from './hooks';

export function SignDialog({ contract, open, onClose, onSigned }: {
    contract: MainContractDto;
    open: boolean;
    onClose: () => void;
    onSigned?: () => void;
}) {
    // Mounted only while open, so the dates start from the contract every time.
    return open ? <SignForm contract={contract} onClose={onClose} onSigned={onSigned} /> : null;
}

function SignForm({ contract, onClose, onSigned }: { contract: MainContractDto; onClose: () => void; onSigned?: () => void }) {
    const t = useTranslations('contracts');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const sign = useSignContract(contract.id, contract.projectId);
    const baseline = useBaseline(contract.projectId);
    const codes = useCostCodes(contract.projectId);
    const version = useQuotationVersion(contract.quotationVersionId ?? undefined);
    const [signDate, setSignDate] = useState(() => contract.signDate ?? bangkokToday(new Date()));
    const [startDate, setStartDate] = useState(() => contract.startDate ?? '');

    const locked = baseline.data?.locked === true;
    // Preview of the allocation: baseline cost codes whose BOQ line is not in the accepted quotation get no selling price.
    const uncovered = useMemo(() => {
        if (!locked || codes.data === undefined || version.data === undefined) return null;
        const keys = new Set(version.data.lines.flatMap(l => (l.lineKey === null ? [] : [l.lineKey])));
        return codes.data.filter(c => c.source === 'baseline' && c.status === 'active' && c.lineKey !== null && !keys.has(c.lineKey)).length;
    }, [locked, codes.data, version.data]);

    const submit = async () => {
        try {
            const res = await sign.mutateAsync({ signDate, ...(startDate !== '' ? { startDate } : {}) });
            void message.success(t('sign.done', { number: res.contract.number ?? '' }));
            if (res.allocation.uncoveredCount > 0) void message.warning(t('sign.uncovered', { count: res.allocation.uncoveredCount }));
            onClose();
            onSigned?.();
        } catch (e) {
            void message.error(toText(e));
        }
    };

    return (
        <Modal open title={t('sign.title')} onCancel={onClose} okText={t('sign.submit')} confirmLoading={sign.isPending}
            okButtonProps={{ disabled: signDate === '' }} onOk={() => { void submit(); }} destroyOnHidden>
            <div className="flex flex-col gap-3">
                <Alert type="info" showIcon title={t('sign.effects')} />
                {baseline.data !== undefined && (
                    <Alert type={locked ? 'success' : 'warning'} showIcon title={locked ? t('sign.baselineLocked') : t('sign.baselineWillLock')} />
                )}
                {uncovered !== null && uncovered > 0 && <Alert type="warning" showIcon title={t('sign.uncovered', { count: uncovered })} />}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="flex flex-col gap-1 text-[13px] text-gray-600">
                        {t('fields.signDate')}
                        <Input type="date" value={signDate} onChange={e => setSignDate(e.target.value)} />
                    </label>
                    <label className="flex flex-col gap-1 text-[13px] text-gray-600">
                        {t('fields.startDate')}
                        <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </label>
                </div>
            </div>
        </Modal>
    );
}
