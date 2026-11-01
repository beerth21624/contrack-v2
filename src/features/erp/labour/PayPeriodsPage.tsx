'use client';

// ─── /workspace/pay-periods: the half-month pay periods of a year (the current one is always listed) + wage advances ───
import { useState } from 'react';
import Link from 'next/link';
import { Alert, Select, Skeleton, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslations } from 'next-intl';
import { can, type PayPeriodSummaryDto } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { DateText } from '../shared/DateText';
import { ErpPage } from '../shared/ErpPage';
import { MoneyText } from '../shared/MoneyText';
import { SectionCard } from '../shared/SectionCard';
import { StatusTag } from '../shared/StatusTag';
import { useErpWorkspace } from '../shared/useErpWorkspace';
import { AdvancesTable } from './AdvancesTable';
import { bangkokToday, payPeriodHref } from './form';
import { usePayPeriods } from './hooks';

export function PayPeriodsPage() {
    const t = useTranslations('labour');
    const toText = useErrorMessage();
    const ws = useErpWorkspace();
    const thisYear = Number(bangkokToday().slice(0, 4));
    const [year, setYear] = useState(thisYear);
    const periods = usePayPeriods(ws.workspaceId, year);
    const years = Array.from({ length: 6 }, (_, i) => thisYear - i);

    const columns: ColumnsType<PayPeriodSummaryDto> = [
        { key: 'period', title: t('periods.columns.period'), render: (_, r) => <Link href={payPeriodHref(r.periodKey)} className="font-medium">{r.periodKey}</Link> },
        { key: 'dates', title: t('periods.columns.dates'), render: (_, r) => <span><DateText value={r.startDate} /> – <DateText value={r.endDate} /></span> },
        { key: 'status', title: t('periods.columns.status'), render: (_, r) => <StatusTag enumName="payPeriodStatus" value={r.status} /> },
        { key: 'lines', title: t('periods.columns.lines'), align: 'right', render: (_, r) => r.lineCount },
        { key: 'gross', title: t('periods.columns.gross'), align: 'right', render: (_, r) => <MoneyText value={r.gross} /> },
        { key: 'deduction', title: t('periods.columns.deduction'), align: 'right', render: (_, r) => <MoneyText value={r.advanceDeduction} /> },
        { key: 'net', title: t('periods.columns.net'), align: 'right', render: (_, r) => <MoneyText value={r.net} /> },
    ];

    return (
        <ErpPage
            title={t('periods.title')}
            subtitle={t('periods.subtitle')}
            extra={<Select className="min-w-[110px]" value={year} onChange={setYear} options={years.map(y => ({ value: y, label: String(y) }))} aria-label={t('periods.year')} />}
        >
            <SectionCard title={t('periods.listTitle')}>
                {periods.isError ? <Alert type="error" showIcon title={toText(periods.error)} />
                    : periods.data === undefined ? <Skeleton active />
                        : <Table<PayPeriodSummaryDto> rowKey="periodKey" size="small" columns={columns} dataSource={periods.data.items} pagination={false} scroll={{ x: 'max-content' }} />}
            </SectionCard>
            {ws.workspaceId !== undefined && <AdvancesTable workspaceId={ws.workspaceId} canWrite={can(ws.role, 'labour.pay')} />}
        </ErpPage>
    );
}
