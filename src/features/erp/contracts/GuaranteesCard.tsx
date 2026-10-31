'use client';

// ─── Guarantees (performance / advance payment / warranty) of a contract: list, add, return ───
import { useState } from 'react';
import { App, Button, Input, Modal, Select, Table } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useTranslations } from 'next-intl';
import {
    GUARANTEE_FORMS, GUARANTEE_KINDS, type ContractGuaranteeDto, type CreateGuaranteeRequest, type FileDto, type MainContractDto,
} from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { ConfirmAction } from '../shared/ConfirmAction';
import { DateText } from '../shared/DateText';
import { FileAttachments } from '../shared/FileAttachments';
import { MoneyInput } from '../shared/MoneyInput';
import { MoneyText } from '../shared/MoneyText';
import { SectionCard } from '../shared/SectionCard';
import { StatusTag } from '../shared/StatusTag';
import { useAddGuarantee, useContractGuarantees, usePatchGuarantee } from './hooks';

const EMPTY: CreateGuaranteeRequest = {
    kind: 'performance', form: 'bank_guarantee', issuer: '', refNo: '', amount: 0, issueDate: null, expiryDate: null, note: '', fileIds: [],
};

export function GuaranteesCard({ contract, canManage, workspaceId }: {
    contract: MainContractDto;
    canManage: boolean;
    workspaceId: string | undefined;
}) {
    const t = useTranslations('contracts');
    const te = useTranslations('enums');
    const list = useContractGuarantees(contract.id);
    const patch = usePatchGuarantee(contract.id);
    const [open, setOpen] = useState(false);
    // Draft, signed or completed contracts take guarantees (the server checks again).
    const mayEdit = canManage && (contract.status === 'draft' || contract.status === 'signed' || contract.status === 'completed');

    const columns: ColumnsType<ContractGuaranteeDto> = [
        { key: 'kind', title: t('guarantees.kind'), render: (_, g) => te(`guaranteeKind.${g.kind}`) },
        { key: 'form', title: t('guarantees.form'), render: (_, g) => te(`guaranteeForm.${g.form}`) },
        { key: 'issuer', title: t('guarantees.issuer'), render: (_, g) => (g.issuer === '' ? '–' : `${g.issuer}${g.refNo !== '' ? ` · ${g.refNo}` : ''}`) },
        { key: 'amount', title: t('guarantees.amount'), align: 'right', render: (_, g) => <MoneyText value={g.amount} /> },
        { key: 'expiry', title: t('guarantees.expiryDate'), render: (_, g) => <DateText value={g.expiryDate} /> },
        { key: 'status', title: t('guarantees.status'), render: (_, g) => <StatusTag enumName="guaranteeStatus" value={g.status} tones={{ returned: 'default', claimed: 'error' }} /> },
        {
            key: 'files', title: t('guarantees.files'),
            render: (_, g) => (g.files.length === 0 ? '–' : <FileAttachments purpose="guarantee_scan" workspaceId={workspaceId} value={g.files} readOnly />),
        },
        {
            key: 'actions', title: '',
            render: (_, g) => mayEdit && g.status === 'active' && (
                <ConfirmAction size="small" title={t('guarantees.returnConfirm')}
                    onConfirm={() => patch.mutateAsync({ id: g.id, body: { status: 'returned' } })}>
                    {t('guarantees.return')}
                </ConfirmAction>
            ),
        },
    ];

    return (
        <SectionCard
            title={t('guarantees.title')}
            extra={mayEdit ? <Button icon={<PlusOutlined />} onClick={() => setOpen(true)}>{t('guarantees.add')}</Button> : undefined}
        >
            {(list.data ?? []).length === 0 && !list.isLoading ? (
                <div className="text-gray-500">{t('guarantees.empty')}</div>
            ) : (
                <Table<ContractGuaranteeDto> size="small" rowKey="id" columns={columns} dataSource={list.data ?? []} loading={list.isLoading}
                    pagination={false} scroll={{ x: 'max-content' }} />
            )}
            {open && <GuaranteeDialog contractId={contract.id} workspaceId={workspaceId} onClose={() => setOpen(false)} />}
        </SectionCard>
    );
}

function GuaranteeDialog({ contractId, workspaceId, onClose }: { contractId: string; workspaceId: string | undefined; onClose: () => void }) {
    const t = useTranslations('contracts');
    const te = useTranslations('enums');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const add = useAddGuarantee(contractId);
    const [v, setV] = useState<CreateGuaranteeRequest>(EMPTY);
    const [files, setFiles] = useState<FileDto[]>([]);
    const set = <K extends keyof CreateGuaranteeRequest>(key: K, value: CreateGuaranteeRequest[K]) => setV(s => ({ ...s, [key]: value }));
    const datesBad = v.issueDate !== null && v.expiryDate !== null && v.expiryDate < v.issueDate;

    const submit = async () => {
        try {
            await add.mutateAsync({ ...v, fileIds: files.map(f => f.id) });
            void message.success(t('guarantees.added'));
            onClose();
        } catch (e) {
            void message.error(toText(e));
        }
    };

    return (
        <Modal open title={t('guarantees.add')} onCancel={onClose} okText={t('actions.save')} confirmLoading={add.isPending}
            okButtonProps={{ disabled: v.amount <= 0 || datesBad }} onOk={() => { void submit(); }} destroyOnHidden>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-1 text-[13px] text-gray-600">{t('guarantees.kind')}
                    <Select value={v.kind} onChange={x => set('kind', x)} options={GUARANTEE_KINDS.map(k => ({ value: k, label: te(`guaranteeKind.${k}`) }))} />
                </label>
                <label className="flex flex-col gap-1 text-[13px] text-gray-600">{t('guarantees.form')}
                    <Select value={v.form} onChange={x => set('form', x)} options={GUARANTEE_FORMS.map(k => ({ value: k, label: te(`guaranteeForm.${k}`) }))} />
                </label>
                <label className="flex flex-col gap-1 text-[13px] text-gray-600">{t('guarantees.issuer')}
                    <Input value={v.issuer} maxLength={200} onChange={e => set('issuer', e.target.value)} />
                </label>
                <label className="flex flex-col gap-1 text-[13px] text-gray-600">{t('guarantees.refNo')}
                    <Input value={v.refNo} maxLength={100} onChange={e => set('refNo', e.target.value)} />
                </label>
                <label className="flex flex-col gap-1 text-[13px] text-gray-600">{t('guarantees.amount')}
                    <MoneyInput value={v.amount} onChange={x => set('amount', x ?? 0)} />
                </label>
                <span />
                <label className="flex flex-col gap-1 text-[13px] text-gray-600">{t('guarantees.issueDate')}
                    <Input type="date" value={v.issueDate ?? ''} onChange={e => set('issueDate', e.target.value === '' ? null : e.target.value)} />
                </label>
                <label className="flex flex-col gap-1 text-[13px] text-gray-600">{t('guarantees.expiryDate')}
                    <Input type="date" value={v.expiryDate ?? ''} onChange={e => set('expiryDate', e.target.value === '' ? null : e.target.value)} />
                </label>
            </div>
            {datesBad && <div className="mt-2 text-[13px] text-red-600">{t('guarantees.datesOrder')}</div>}
            <label className="mt-3 flex flex-col gap-1 text-[13px] text-gray-600">{t('guarantees.note')}
                <Input.TextArea rows={2} maxLength={2000} value={v.note} onChange={e => set('note', e.target.value)} />
            </label>
            <div className="mt-3">
                <div className="mb-1 text-[13px] text-gray-600">{t('guarantees.files')}</div>
                <FileAttachments purpose="guarantee_scan" workspaceId={workspaceId} value={files} onChange={setFiles} />
            </div>
        </Modal>
    );
}
