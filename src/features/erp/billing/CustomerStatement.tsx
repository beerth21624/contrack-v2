'use client';

// ─── A customer's statement of account: invoices (debit) and receipts (credit) with a running balance ───
import { useState } from 'react';
import Link from 'next/link';
import { Input, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslations } from 'next-intl';
import type { CustomerStatementDto } from '@/shared/contract';
import { DateText } from '../shared/DateText';
import { DocumentNumberTag } from '../shared/DocumentNumberTag';
import { MoneyText } from '../shared/MoneyText';
import { SectionCard } from '../shared/SectionCard';
import { useCustomerStatement } from './hooks';
import { billingHref } from './status';

type Entry = CustomerStatementDto['entries'][number];

export function CustomerStatement({ customerId }: { customerId: string }) {
    const t = useTranslations('billing');
    const te = useTranslations('enums');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const badRange = from !== '' && to !== '' && to < from;
    const q = useCustomerStatement(customerId, badRange ? '' : from, badRange ? '' : to);
    const s = q.data;

    const columns: ColumnsType<Entry> = [
        { key: 'date', title: t('statement.date'), render: (_, e) => <DateText value={e.date} /> },
        { key: 'type', title: t('statement.type'), render: (_, e) => (e.type === 'receipt' ? t('statement.receipt') : te(`invoiceKind.${e.kind ?? 'invoice'}`)) },
        {
            key: 'number', title: t('fields.number'),
            render: (_, e) => (e.type === 'invoice' && e.projectId !== null ? <Link href={billingHref(e.projectId)}><DocumentNumberTag number={e.number} /></Link> : <DocumentNumberTag number={e.number} />),
        },
        { key: 'debit', title: t('statement.debit'), align: 'right', render: (_, e) => (e.debit === 0 ? '–' : <MoneyText value={e.debit} />) },
        { key: 'credit', title: t('statement.credit'), align: 'right', render: (_, e) => (e.credit === 0 ? '–' : <MoneyText value={e.credit} />) },
        { key: 'balance', title: t('statement.balance'), align: 'right', render: (_, e) => <MoneyText value={e.balance} /> },
    ];

    return (
        <SectionCard title={t('statement.title')}
            extra={(
                <div className="flex flex-wrap items-center gap-2">
                    <Input type="date" aria-label={t('statement.from')} className="!w-[150px]" value={from} onChange={e => setFrom(e.target.value)} />
                    <Input type="date" aria-label={t('statement.to')} className="!w-[150px]" value={to} onChange={e => setTo(e.target.value)} />
                </div>
            )}>
            {badRange && <div className="mb-2 text-[13px] text-red-600">{t('statement.rangeOrder')}</div>}
            <Table<Entry> size="small" rowKey={e => `${e.type}:${e.documentId}`} columns={columns} dataSource={s?.entries ?? []} loading={q.isLoading} pagination={false}
                scroll={{ x: 'max-content' }} locale={{ emptyText: t('statement.empty') }}
                title={s === undefined ? undefined : () => <span>{t('statement.opening')}: <MoneyText value={s.openingBalance} /></span>}
                footer={s === undefined ? undefined : () => <b>{t('statement.closing')}: <MoneyText value={s.closingBalance} currency /></b>} />
        </SectionCard>
    );
}
