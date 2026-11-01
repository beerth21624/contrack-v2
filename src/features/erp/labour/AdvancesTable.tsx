'use client';

// ─── Wage advances (เบิกล่วงหน้า): list, add, mark paid, write off. Recovered from the next pay periods automatically ───
import { useState } from 'react';
import { Alert, App, Button, DatePicker, Form, Input, Modal, Select, Skeleton, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { LABOUR_PAYMENT_METHODS, type LabourPaymentMethod, type WageAdvanceDto } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { usePeople } from '@/features/cloud/api/workforce';
import { ConfirmAction } from '../shared/ConfirmAction';
import { DateText } from '../shared/DateText';
import { EmptyState } from '../shared/EmptyState';
import { MoneyInput } from '../shared/MoneyInput';
import { MoneyText } from '../shared/MoneyText';
import { SectionCard } from '../shared/SectionCard';
import { StatusTag } from '../shared/StatusTag';
import { bangkokToday } from './form';
import { useCreateWageAdvance, usePatchWageAdvance, useWageAdvances } from './hooks';

interface AdvanceForm {
    personId: string;
    advanceDate: dayjs.Dayjs;
    amount: number;
    reason?: string;
    paymentMethod?: LabourPaymentMethod;
}

export function AdvancesTable({ workspaceId, canWrite }: { workspaceId: string; canWrite: boolean }) {
    const t = useTranslations('labour.advances');
    const tm = useTranslations('enums.labourPaymentMethod');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const list = useWageAdvances(workspaceId);
    const people = usePeople(workspaceId);
    const create = useCreateWageAdvance(workspaceId);
    const patch = usePatchWageAdvance(workspaceId);
    const [open, setOpen] = useState(false);
    const [payFor, setPayFor] = useState<WageAdvanceDto | null>(null);
    const [payMethod, setPayMethod] = useState<LabourPaymentMethod>('cash');
    const [form] = Form.useForm<AdvanceForm>();
    const hidden = list.data?.wagesHidden === true;
    const methodOptions = LABOUR_PAYMENT_METHODS.map(m => ({ value: m, label: tm(m) }));

    const submit = async (v: AdvanceForm) => {
        try {
            await create.mutateAsync({
                personId: v.personId, advanceDate: v.advanceDate.format('YYYY-MM-DD'), amount: v.amount,
                ...(v.reason === undefined || v.reason.trim() === '' ? {} : { reason: v.reason }),
                ...(v.paymentMethod === undefined ? {} : { paymentMethod: v.paymentMethod }),
            });
            void message.success(t('created'));
            setOpen(false);
            form.resetFields();
        } catch (err) {
            void message.error(toText(err));
        }
    };

    const markPaid = async () => {
        if (payFor === null) return;
        try {
            await patch.mutateAsync({ advanceId: payFor.id, body: { paymentMethod: payMethod } });
            void message.success(t('paidDone'));
            setPayFor(null);
        } catch (err) {
            void message.error(toText(err));
        }
    };

    const columns: ColumnsType<WageAdvanceDto> = [
        { key: 'person', title: t('columns.person'), dataIndex: 'personName' },
        { key: 'date', title: t('columns.date'), render: (_, r) => <DateText value={r.advanceDate} /> },
        { key: 'amount', title: t('columns.amount'), align: 'right', render: (_, r) => <MoneyText value={r.amount} /> },
        { key: 'recovered', title: t('columns.recovered'), align: 'right', render: (_, r) => <MoneyText value={r.recoveredAmount} /> },
        { key: 'outstanding', title: t('columns.outstanding'), align: 'right', render: (_, r) => <MoneyText value={r.outstanding} /> },
        { key: 'status', title: t('columns.status'), render: (_, r) => <StatusTag enumName="wageAdvanceStatus" value={r.status} /> },
        { key: 'paid', title: t('columns.paid'), render: (_, r) => (r.paidAt === null ? <span className="text-gray-500">{t('notPaid')}</span> : <span>{r.paymentMethod === null ? '' : tm(r.paymentMethod)} · <DateText value={r.paidAt} /></span>) },
        { key: 'reason', title: t('columns.reason'), dataIndex: 'reason' },
        {
            key: 'actions', title: '', align: 'right',
            render: (_, r) => !canWrite || hidden ? null : (
                <div className="flex justify-end gap-2">
                    {r.paidAt === null && r.status === 'open' && <Button size="small" onClick={() => { setPayMethod('cash'); setPayFor(r); }}>{t('markPaid')}</Button>}
                    {(r.status === 'open' || r.status === 'partially_recovered') && (
                        <ConfirmAction size="small" danger title={t('writeOffTitle')} content={t('writeOffBody')}
                            onConfirm={() => patch.mutateAsync({ advanceId: r.id, body: { status: 'written_off' } })}>
                            {t('writeOff')}
                        </ConfirmAction>
                    )}
                </div>
            ),
        },
    ];

    return (
        <SectionCard title={t('title')} extra={canWrite && !hidden ? <Button type="primary" onClick={() => setOpen(true)}>{t('add')}</Button> : undefined}>
            <div className="mb-3 text-[13px] text-gray-500">{t('hint')}</div>
            {list.isError ? <Alert type="error" showIcon title={toText(list.error)} />
                : list.data === undefined ? <Skeleton active />
                    : hidden ? <Alert type="info" showIcon title={t('hidden')} />
                        : list.data.items.length === 0 ? <EmptyState title={t('empty')} />
                            : <Table<WageAdvanceDto> rowKey="id" size="small" columns={columns} dataSource={list.data.items} pagination={{ pageSize: 20, hideOnSinglePage: true }} scroll={{ x: 'max-content' }} />}
            <Modal open={open} title={t('add')} okText={t('save')} cancelText={t('cancel')} confirmLoading={create.isPending}
                onCancel={() => setOpen(false)} onOk={() => form.submit()} destroyOnHidden>
                <Form<AdvanceForm> form={form} layout="vertical" initialValues={{ advanceDate: dayjs(bangkokToday()) }} onFinish={v => { void submit(v); }}>
                    <Form.Item name="personId" label={t('columns.person')} rules={[{ required: true }]}>
                        <Select showSearch={{ optionFilterProp: 'label' }} options={(people.data ?? []).filter(p => p.archivedAt === null).map(p => ({ value: p.id, label: p.name }))} />
                    </Form.Item>
                    <Form.Item name="advanceDate" label={t('columns.date')} rules={[{ required: true }]}><DatePicker className="!w-full" allowClear={false} /></Form.Item>
                    <Form.Item name="amount" label={t('columns.amount')} rules={[{ required: true }]}><MoneyInput min={0.01} /></Form.Item>
                    <Form.Item name="paymentMethod" label={t('payNow')} extra={t('payNowHint')}><Select allowClear options={methodOptions} placeholder={t('notPaid')} /></Form.Item>
                    <Form.Item name="reason" label={t('columns.reason')}><Input maxLength={500} /></Form.Item>
                </Form>
            </Modal>
            <Modal open={payFor !== null} title={t('markPaid')} okText={t('save')} cancelText={t('cancel')} confirmLoading={patch.isPending}
                onCancel={() => setPayFor(null)} onOk={() => { void markPaid(); }} destroyOnHidden>
                <div className="mb-2 text-[13px] text-gray-600">{payFor?.personName} · <MoneyText value={payFor?.amount} currency /></div>
                <Select className="!w-full" value={payMethod} options={methodOptions} onChange={setPayMethod} />
            </Modal>
        </SectionCard>
    );
}
