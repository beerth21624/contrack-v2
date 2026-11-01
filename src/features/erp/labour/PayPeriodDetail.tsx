'use client';

// ─── /workspace/pay-periods/<key>: build (approved timesheets − advances) → approve → pay → print ───
import { useState } from 'react';
import Link from 'next/link';
import { Alert, App, Button, DatePicker, Descriptions, Modal, Select, Skeleton, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { LABOUR_PAYMENT_METHODS, type LabourPaymentMethod, type PayLineDto, payPeriodKeySchema } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useModuleEnabled } from '@/features/modules/modules';
import { ConfirmAction } from '../shared/ConfirmAction';
import { DateText } from '../shared/DateText';
import { ErpPage } from '../shared/ErpPage';
import { MoneyText } from '../shared/MoneyText';
import { SectionCard } from '../shared/SectionCard';
import { StatusTag } from '../shared/StatusTag';
import { useErpWorkspace } from '../shared/useErpWorkspace';
import { bangkokToday, payPeriodPrintHref, yearOfPeriodKey } from './form';
import { usePayPeriod, usePayPeriods, usePeriodAction } from './hooks';

export function PayPeriodDetail({ periodKey }: { periodKey: string }) {
    const t = useTranslations('labour');
    const tm = useTranslations('enums.labourPaymentMethod');
    const ws = useErpWorkspace();
    if (!payPeriodKeySchema.safeParse(periodKey).success) {
        return <ErpPage title={t('periods.title')}><Alert type="warning" showIcon title={t('periods.badKey')} /></ErpPage>;
    }
    if (ws.workspaceId === undefined) return <ErpPage><Skeleton active /></ErpPage>;
    return <Inner workspaceId={ws.workspaceId} periodKey={periodKey} tm={tm} />;
}

function Inner({ workspaceId, periodKey, tm }: { workspaceId: string; periodKey: string; tm: (k: LabourPaymentMethod) => string }) {
    const t = useTranslations('labour');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const list = usePayPeriods(workspaceId, yearOfPeriodKey(periodKey));
    const summary = list.data?.items.find(p => p.periodKey === periodKey);
    const periodId = summary?.id ?? null;
    const detail = usePayPeriod(periodId);
    const actions = usePeriodAction(workspaceId, periodKey);
    const payables = useModuleEnabled('payables', workspaceId);
    const [payOpen, setPayOpen] = useState(false);
    const [method, setMethod] = useState<LabourPaymentMethod>('transfer');
    const [paidDate, setPaidDate] = useState(bangkokToday());

    const crumbs = [{ label: t('periods.title'), href: '/workspace/pay-periods' }, { label: periodKey }];
    const err = list.isError ? list.error : detail.isError ? detail.error : null;
    if (err !== null) return <ErpPage breadcrumb={crumbs}><Alert type="error" showIcon title={toText(err)} /></ErpPage>;
    if (summary === undefined || (periodId !== null && detail.data === undefined)) return <ErpPage breadcrumb={crumbs}><Skeleton active /></ErpPage>;

    const p = detail.data ?? { ...summary, lines: [] as PayLineDto[], unapprovedCount: 0, wagesHidden: false, canBuild: true, canApprove: false, canPay: false };
    const run = async (fn: () => Promise<unknown>, ok: string) => {
        try {
            await fn();
            void message.success(ok);
        } catch (e) {
            void message.error(toText(e));
        }
    };
    const pay = async () => {
        await run(() => actions.pay.mutateAsync({ paymentMethod: method, paidDate }), t('detail.paidDone'));
        setPayOpen(false);
    };

    const columns: ColumnsType<PayLineDto> = [
        { key: 'person', title: t('detail.columns.person'), dataIndex: 'personName' },
        { key: 'days', title: t('detail.columns.days'), align: 'right', render: (_, r) => r.days },
        { key: 'ot', title: t('detail.columns.ot'), align: 'right', render: (_, r) => r.otHours },
        { key: 'gross', title: t('detail.columns.gross'), align: 'right', render: (_, r) => <MoneyText value={r.gross} /> },
        { key: 'advance', title: t('detail.columns.advance'), align: 'right', render: (_, r) => <MoneyText value={r.advanceDeduction} /> },
        { key: 'other', title: t('detail.columns.other'), align: 'right', render: (_, r) => <MoneyText value={r.otherDeduction} /> },
        { key: 'net', title: t('detail.columns.net'), align: 'right', render: (_, r) => <MoneyText value={r.net} className="font-medium" /> },
        { key: 'paid', title: t('detail.columns.paid'), render: (_, r) => (r.paid ? <StatusTag enumName="payPeriodStatus" value="paid" /> : '–') },
    ];

    const showPay = p.canPay && p.status === 'approved' && !payables.enabled;
    const viaPayables = p.status === 'approved' && payables.enabled;

    return (
        <ErpPage
            title={`${t('detail.title')} ${periodKey}`}
            breadcrumb={crumbs}
            extra={(
                <div className="flex flex-wrap items-center gap-2">
                    <StatusTag enumName="payPeriodStatus" value={p.status} />
                    {p.id !== null && p.lines.length > 0 && <Link href={payPeriodPrintHref(p.id)} target="_blank"><Button>{t('detail.print')}</Button></Link>}
                    {p.canBuild && p.status === 'open' && (
                        <Button loading={actions.build.isPending} onClick={() => { void run(() => actions.build.mutateAsync(), t('detail.builtDone')); }}>
                            {p.id === null ? t('detail.build') : t('detail.rebuild')}
                        </Button>
                    )}
                    {p.canApprove && p.status === 'open' && p.id !== null && p.lines.length > 0 && (
                        <ConfirmAction type="primary" title={t('detail.approveTitle')} content={t('detail.approveBody')}
                            onConfirm={() => run(() => actions.approve.mutateAsync(), t('detail.approvedDone'))}>
                            {t('detail.approve')}
                        </ConfirmAction>
                    )}
                    {showPay && <Button type="primary" onClick={() => setPayOpen(true)}>{t('detail.pay')}</Button>}
                </div>
            )}
        >
            {p.unapprovedCount > 0 && p.status === 'open' && <Alert type="warning" showIcon title={t('detail.unapproved', { count: p.unapprovedCount })} />}
            {viaPayables && (
                <Alert type="info" showIcon title={t('detail.viaPayables')}
                    action={<Link href="/payables"><Button size="small">{t('detail.createBill')}</Button></Link>} />
            )}
            {p.status === 'pending_approval' && <Alert type="info" showIcon title={t('detail.pendingApproval')} />}
            <SectionCard>
                <Descriptions size="small" column={{ xs: 1, sm: 2, md: 4 }}>
                    <Descriptions.Item label={t('periods.columns.dates')}><DateText value={p.startDate} /> – <DateText value={p.endDate} /></Descriptions.Item>
                    <Descriptions.Item label={t('periods.columns.gross')}><MoneyText value={p.wagesHidden ? null : p.gross} /></Descriptions.Item>
                    <Descriptions.Item label={t('periods.columns.deduction')}><MoneyText value={p.wagesHidden ? null : p.advanceDeduction} /></Descriptions.Item>
                    <Descriptions.Item label={t('periods.columns.net')}><MoneyText value={p.wagesHidden ? null : p.net} className="font-semibold" /></Descriptions.Item>
                    {p.paidAt !== null && <Descriptions.Item label={t('detail.paidOn')}><DateText value={p.paidDate ?? p.paidAt} />{p.paymentMethod !== null && ` · ${tm(p.paymentMethod)}`}</Descriptions.Item>}
                </Descriptions>
            </SectionCard>
            <SectionCard title={t('detail.lines')}>
                {p.id === null ? <div className="text-[13px] text-gray-500">{t('detail.notBuilt')}</div>
                    : <Table<PayLineDto> rowKey="id" size="small" columns={columns} dataSource={p.lines} pagination={false} scroll={{ x: 'max-content' }} />}
            </SectionCard>
            <Modal open={payOpen} title={t('detail.pay')} okText={t('detail.payConfirm')} cancelText={t('advances.cancel')} confirmLoading={actions.pay.isPending}
                onCancel={() => setPayOpen(false)} onOk={() => { void pay(); }}>
                <div className="flex flex-col gap-3">
                    <div className="text-[13px] text-gray-600">{t('detail.payBody')} <MoneyText value={p.net} currency className="font-semibold" /></div>
                    <label className="flex flex-col gap-1 text-[13px] text-gray-600">{t('detail.method')}
                        <Select value={method} onChange={setMethod} options={LABOUR_PAYMENT_METHODS.map(m => ({ value: m, label: tm(m) }))} />
                    </label>
                    <label className="flex flex-col gap-1 text-[13px] text-gray-600">{t('detail.paidDate')}
                        <DatePicker allowClear={false} value={dayjs(paidDate)} disabledDate={d => d.isAfter(dayjs(bangkokToday()), 'day')}
                            onChange={d => { if (d !== null) setPaidDate(d.format('YYYY-MM-DD')); }} />
                    </label>
                </div>
            </Modal>
        </ErpPage>
    );
}
