'use client';

// ─── /p/[projectId]/variations: the VOs of a project (newest first) + create a draft ───
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, App, Button, Input, InputNumber, Modal, Select, Skeleton, Table } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useTranslations } from 'next-intl';
import {
    CONTRACT_VARIATION_BILLINGS, DOC_LANGUAGES, VARIATION_REASONS, can, type ContractVariationBilling, type DocLanguage,
    type VariationOrderSummaryDto, type VariationReason,
} from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useProjectContract } from '../contracts/hooks';
import { useHubProject } from '../hub/hooks';
import { DateText } from '../shared/DateText';
import { DocumentNumberTag } from '../shared/DocumentNumberTag';
import { EmptyState } from '../shared/EmptyState';
import { MoneyText } from '../shared/MoneyText';
import { SectionCard } from '../shared/SectionCard';
import { StatusTag } from '../shared/StatusTag';
import { useErpWorkspace } from '../shared/useErpWorkspace';
import { useCreateVariation, useVariations } from './hooks';
import { VARIATION_STATUS_TONES, variationHref } from './status';

/** Billing options a contract allows (`next_claim` only on a progress-billed contract). */
export function billingOptions(billingMode: string | undefined): readonly ContractVariationBilling[] {
    return billingMode === 'milestone' ? CONTRACT_VARIATION_BILLINGS.filter(b => b !== 'next_claim') : CONTRACT_VARIATION_BILLINGS;
}

function CreateDialog({ projectId, open, onClose, billingMode, language }: {
    projectId: string;
    open: boolean;
    onClose: () => void;
    billingMode: string | undefined;
    language: DocLanguage | undefined;
}) {
    const t = useTranslations('variations');
    const te = useTranslations('enums');
    const router = useRouter();
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const create = useCreateVariation(projectId);
    const [title, setTitle] = useState('');
    const [requestedByName, setRequestedByName] = useState('');
    const [reason, setReason] = useState<VariationReason>('owner_request');
    const [requestedDate, setRequestedDate] = useState('');
    const [billing, setBilling] = useState<ContractVariationBilling | undefined>(undefined);
    const [days, setDays] = useState<number>(0);
    const [lang, setLang] = useState<DocLanguage | undefined>(undefined);

    const submit = async () => {
        try {
            const v = await create.mutateAsync({
                title: title.trim(), requestedByName: requestedByName.trim(), reason,
                ...(requestedDate !== '' ? { requestedDate } : {}),
                ...(billing !== undefined ? { billing } : {}),
                scheduleImpactDays: days,
                ...(lang !== undefined ? { language: lang } : {}),
            });
            void message.success(t('create.done'));
            onClose();
            router.push(variationHref(projectId, v.id));
        } catch (e) {
            void message.error(toText(e));
        }
    };

    return (
        <Modal open={open} title={t('create.title')} onCancel={onClose} okText={t('create.submit')} confirmLoading={create.isPending}
            okButtonProps={{ disabled: title.trim() === '' || requestedByName.trim() === '' }} onOk={() => { void submit(); }} destroyOnHidden>
            <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1 text-[13px] text-gray-600">
                    {t('fields.title')}
                    <Input value={title} maxLength={200} onChange={e => setTitle(e.target.value)} placeholder={t('fields.titlePlaceholder')} />
                </label>
                <label className="flex flex-col gap-1 text-[13px] text-gray-600">
                    {t('fields.requestedByName')}
                    <Input value={requestedByName} maxLength={200} onChange={e => setRequestedByName(e.target.value)} />
                </label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-[13px] text-gray-600">
                        {t('fields.reason')}
                        <Select value={reason} onChange={setReason} options={VARIATION_REASONS.map(r => ({ value: r, label: te(`variationReason.${r}`) }))} />
                    </label>
                    <label className="flex flex-col gap-1 text-[13px] text-gray-600">
                        {t('fields.requestedDate')}
                        <Input type="date" value={requestedDate} onChange={e => setRequestedDate(e.target.value)} />
                    </label>
                    <label className="flex flex-col gap-1 text-[13px] text-gray-600">
                        {t('fields.billing')}
                        <Select value={billing} onChange={setBilling} allowClear placeholder={t('fields.billingDefault')}
                            options={billingOptions(billingMode).map(b => ({ value: b, label: te(`variationBilling.${b}`) }))} />
                    </label>
                    <label className="flex flex-col gap-1 text-[13px] text-gray-600">
                        {t('fields.scheduleImpactDays')}
                        <InputNumber<number> className="!w-full" value={days} min={-3650} max={3650} precision={0}
                            onChange={v => setDays(v ?? 0)} />
                    </label>
                    <label className="flex flex-col gap-1 text-[13px] text-gray-600">
                        {t('fields.language')}
                        <Select value={lang ?? language} onChange={setLang}
                            options={DOC_LANGUAGES.map(l => ({ value: l, label: t(`languages.${l}`) }))} />
                    </label>
                </div>
            </div>
        </Modal>
    );
}

export function VariationsPage({ projectId }: { projectId: string }) {
    const t = useTranslations('variations');
    const toText = useErrorMessage();
    const list = useVariations(projectId);
    const hub = useHubProject(projectId);
    const contract = useProjectContract(projectId);
    const ws = useErpWorkspace(hub.data?.project.workspaceId);
    const [dialog, setDialog] = useState(false);
    const signed = contract.data?.contract?.status === 'signed';
    const mayManage = can(ws.role, 'variations.manage');

    if (list.isLoading) return <Skeleton active />;
    if (list.isError) {
        return (
            <Alert type="error" showIcon title={`${t('loadFailed')}: ${toText(list.error)}`}
                action={<Button size="small" onClick={() => { void list.refetch(); }}>{t('retry')}</Button>} />
        );
    }
    const rows = list.data ?? [];
    const createButton = mayManage && signed
        ? <Button type="primary" icon={<PlusOutlined />} onClick={() => setDialog(true)}>{t('list.create')}</Button>
        : undefined;

    const columns: ColumnsType<VariationOrderSummaryDto> = [
        { key: 'seq', title: t('list.columns.seq'), render: (_, v) => <span className="tabular-nums">{v.seqNo}</span> },
        {
            key: 'title', title: t('list.columns.title'),
            render: (_, v) => <Link href={variationHref(projectId, v.id)} className="font-medium break-words">{v.title}</Link>,
        },
        { key: 'number', title: t('list.columns.number'), render: (_, v) => <DocumentNumberTag number={v.number} /> },
        { key: 'status', title: t('list.columns.status'), render: (_, v) => <StatusTag enumName="variationStatus" value={v.status} tones={VARIATION_STATUS_TONES} /> },
        { key: 'sell', title: t('list.columns.sellTotal'), align: 'right', render: (_, v) => <MoneyText value={v.sellTotal} className="font-semibold" /> },
        { key: 'days', title: t('list.columns.days'), align: 'right', render: (_, v) => <span className="tabular-nums">{v.scheduleImpactDays}</span> },
        { key: 'updatedAt', title: t('list.columns.updatedAt'), render: (_, v) => <DateText value={v.updatedAt} style="dateTime" /> },
    ];

    return (
        <div className="flex min-w-0 flex-col gap-4">
            {contract.data !== undefined && !signed && <Alert type="info" showIcon title={t('list.needsContract')} />}
            <SectionCard title={t('list.title')} extra={createButton}>
                {rows.length === 0 ? (
                    <EmptyState title={t('list.empty.title')} hint={t('list.empty.hint')} action={createButton} />
                ) : (
                    <Table<VariationOrderSummaryDto> size="small" rowKey="id" columns={columns} dataSource={rows}
                        pagination={rows.length > 20 ? { pageSize: 20, showSizeChanger: false } : false} scroll={{ x: 'max-content' }} />
                )}
            </SectionCard>
            <CreateDialog projectId={projectId} open={dialog} onClose={() => setDialog(false)}
                billingMode={contract.data?.contract?.billingMode} language={contract.data?.contract?.language} />
        </div>
    );
}
