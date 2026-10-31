'use client';

// ─── The retention the customer holds: balance, release plan, release invoice ───
import { useState } from 'react';
import { App, Button, Descriptions, Modal } from 'antd';
import { useTranslations } from 'next-intl';
import type { MainContractDto } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { DateText } from '../shared/DateText';
import { MoneyInput } from '../shared/MoneyInput';
import { MoneyText } from '../shared/MoneyText';
import { SectionCard } from '../shared/SectionCard';
import { useContractRetention, useCreateRetentionInvoice } from './hooks';

export function RetentionCard({ contract, canManage }: { contract: MainContractDto; canManage: boolean }) {
    const t = useTranslations('billing');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const q = useContractRetention(contract.id);
    const create = useCreateRetentionInvoice(contract.id);
    const [amount, setAmount] = useState<number | null>(null);
    const r = q.data;
    // Nothing was ever held: nothing to show.
    if (r === undefined || (r.withheld <= 0 && r.balance <= 0)) return null;

    const submit = async () => {
        if (amount === null || amount <= 0) return;
        try {
            await create.mutateAsync({ amount });
            setAmount(null);
            void message.success(t('retention.created'));
        } catch (e) {
            void message.error(toText(e));
        }
    };

    return (
        <SectionCard
            title={t('retention.title')}
            extra={canManage && r.releasable > 0 ? <Button onClick={() => setAmount(r.releasable)}>{t('retention.release')}</Button> : undefined}
        >
            <Descriptions size="small" column={{ xs: 1, md: 2, xl: 4 }} bordered>
                <Descriptions.Item label={t('retention.withheld')}><MoneyText value={r.withheld} currency /></Descriptions.Item>
                <Descriptions.Item label={t('retention.released')}><MoneyText value={r.released} currency /></Descriptions.Item>
                <Descriptions.Item label={t('retention.balance')}><MoneyText value={r.balance} currency /></Descriptions.Item>
                <Descriptions.Item label={t('retention.cap')}>{r.cap === null ? '–' : <MoneyText value={r.cap} currency />}</Descriptions.Item>
            </Descriptions>
            {r.schedule.length > 0 && (
                <div className="mt-3 flex flex-col gap-1 text-[13px]">
                    <div className="font-medium text-gray-700">{t('retention.schedule')}</div>
                    {r.schedule.map(s => (
                        <div key={s.stage} className="flex flex-wrap items-center gap-x-3">
                            <span>{t(`retention.stage.${s.stage}`)}</span>
                            <MoneyText value={s.amount} currency />
                            <span className="text-gray-500">{s.dueAt === null ? t('retention.noDate') : <DateText value={s.dueAt} />}</span>
                        </div>
                    ))}
                </div>
            )}
            <Modal open={amount !== null} title={t('retention.release')} okText={t('retention.createInvoice')} confirmLoading={create.isPending}
                okButtonProps={{ disabled: amount === null || amount <= 0 || amount > r.releasable + 0.005 }}
                onCancel={() => setAmount(null)} onOk={() => { void submit(); }} destroyOnHidden>
                <div className="mb-2 text-[13px] text-gray-500">{t('retention.releaseHint')}</div>
                <MoneyInput value={amount ?? 0} max={r.releasable} onChange={x => setAmount(x ?? 0)} />
            </Modal>
        </SectionCard>
    );
}
