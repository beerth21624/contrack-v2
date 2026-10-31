'use client';

// ─── The advance payment of a contract: amount, received / recovered, the advance invoice ───
import { App, Descriptions } from 'antd';
import { useTranslations } from 'next-intl';
import type { MainContractDto } from '@/shared/contract';
import { ConfirmAction } from '../shared/ConfirmAction';
import { DocumentNumberTag } from '../shared/DocumentNumberTag';
import { MoneyText } from '../shared/MoneyText';
import { SectionCard } from '../shared/SectionCard';
import { StatusTag } from '../shared/StatusTag';
import { useContractAdvance, useCreateAdvanceInvoice } from './hooks';
import { INVOICE_STATUS_TONES } from './status';

export function AdvanceCard({ contract }: { contract: MainContractDto }) {
    const t = useTranslations('billing');
    const { message } = App.useApp();
    const q = useContractAdvance(contract.id);
    const create = useCreateAdvanceInvoice(contract.id);
    const a = q.data;
    // No advance on this contract: nothing to show.
    if (a === undefined || a.amount <= 0) return null;

    return (
        <SectionCard
            title={t('advance.title')}
            extra={a.canCreateInvoice ? (
                <ConfirmAction type="primary" title={t('advance.createConfirm')}
                    onConfirm={async () => { await create.mutateAsync({}); void message.success(t('advance.created')); }}>
                    {t('advance.create')}
                </ConfirmAction>
            ) : undefined}
        >
            <Descriptions size="small" column={{ xs: 1, md: 2, xl: 4 }} bordered>
                <Descriptions.Item label={t('advance.amount')}><MoneyText value={a.amount} currency /></Descriptions.Item>
                <Descriptions.Item label={t('advance.received')}><MoneyText value={a.received} currency /></Descriptions.Item>
                <Descriptions.Item label={t('advance.recovered')}><MoneyText value={a.recovered} currency /></Descriptions.Item>
                <Descriptions.Item label={t('advance.balance')}><MoneyText value={a.balance} currency /></Descriptions.Item>
                <Descriptions.Item label={t('advance.invoice')}>
                    {a.invoice === null ? t('advance.none') : (
                        <span className="inline-flex flex-wrap items-center gap-2">
                            <DocumentNumberTag number={a.invoice.number} />
                            <StatusTag enumName="invoiceStatus" value={a.invoice.status} tones={INVOICE_STATUS_TONES} />
                        </span>
                    )}
                </Descriptions.Item>
            </Descriptions>
        </SectionCard>
    );
}
