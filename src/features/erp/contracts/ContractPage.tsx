'use client';

// ─── /p/[projectId]/contract: the main contract of a project (wizard while draft, the contract once signed) ───
import { useState } from 'react';
import { Alert, App, Button, Descriptions, Input, Modal, Progress, Skeleton, Table, Tag, Upload } from 'antd';
import { PrinterOutlined, UploadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useTranslations } from 'next-intl';
import { ALLOWED_CONTENT_TYPES, can, type MainContractDto, type MainContractSummaryDto } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useFormat } from '@/i18n/useFormat';
import { useCustomer } from '../customers/hooks';
import { useHubProject } from '../hub/hooks';
import { ConfirmAction } from '../shared/ConfirmAction';
import { DateText } from '../shared/DateText';
import { DocumentNumberTag } from '../shared/DocumentNumberTag';
import { EmptyState } from '../shared/EmptyState';
import { FileAttachments } from '../shared/FileAttachments';
import { MoneyText } from '../shared/MoneyText';
import { SectionCard } from '../shared/SectionCard';
import { StatusTag } from '../shared/StatusTag';
import { uploadErpFile, uploadProblem } from '../shared/files';
import { useErpWorkspace } from '../shared/useErpWorkspace';
import { ContractWizard, contractPrintHref } from './ContractWizard';
import { GuaranteesCard } from './GuaranteesCard';
import { MilestonesReadOnly } from './MilestonesEditor';
import { TermsForm } from './TermsForm';
import { useAddSignedScan, useCloseContract, useProjectContract, useTerminateContract } from './hooks';
import { CONTRACT_STATUS_TONES } from './status';

export function ContractPage({ projectId }: { projectId: string }) {
    const t = useTranslations('contracts');
    const toText = useErrorMessage();
    const q = useProjectContract(projectId);
    const hub = useHubProject(projectId);
    const ws = useErpWorkspace(hub.data?.project.workspaceId);
    const canManage = can(ws.role, 'contracts.manage');

    if (q.isLoading) return <Skeleton active />;
    if (q.isError || q.data === undefined) {
        return (
            <Alert type="error" showIcon title={`${t('loadFailed')}: ${toText(q.error)}`}
                action={<Button size="small" onClick={() => { void q.refetch(); }}>{t('retry')}</Button>} />
        );
    }
    const { contract, ended } = q.data;

    return (
        <div className="flex min-w-0 flex-col gap-4">
            {contract === null && !canManage && (
                <SectionCard><EmptyState title={t('empty.title')} hint={t('empty.readOnly')} /></SectionCard>
            )}
            {(contract === null ? canManage : contract.status === 'draft' && contract.canEdit) && (
                <ContractWizard projectId={projectId} workspaceId={ws.workspaceId} contract={contract} />
            )}
            {contract !== null && !(contract.status === 'draft' && contract.canEdit) && (
                <ContractDetail contract={contract} canManage={canManage} workspaceId={ws.workspaceId} />
            )}
            {ended.length > 0 && <EndedContracts rows={ended} />}
        </div>
    );
}

function EndedContracts({ rows }: { rows: MainContractSummaryDto[] }) {
    const t = useTranslations('contracts');
    const columns: ColumnsType<MainContractSummaryDto> = [
        { key: 'number', title: t('fields.number'), render: (_, c) => <DocumentNumberTag number={c.number} /> },
        { key: 'title', title: t('fields.title'), render: (_, c) => c.title },
        { key: 'status', title: t('fields.status'), render: (_, c) => <StatusTag enumName="contractStatus" value={c.status} tones={CONTRACT_STATUS_TONES} /> },
        { key: 'value', title: t('fields.currentValue'), align: 'right', render: (_, c) => <MoneyText value={c.currentValue} /> },
        { key: 'sign', title: t('fields.signDate'), render: (_, c) => <DateText value={c.signDate} /> },
        { key: 'print', title: '', render: (_, c) => <a href={contractPrintHref(c.id)} target="_blank" rel="noopener noreferrer">{t('actions.print')}</a> },
    ];
    return (
        <SectionCard title={t('ended.title')}>
            <Table<MainContractSummaryDto> size="small" rowKey="id" columns={columns} dataSource={rows} pagination={false} scroll={{ x: 'max-content' }} />
        </SectionCard>
    );
}

function ContractDetail({ contract, canManage, workspaceId }: { contract: MainContractDto; canManage: boolean; workspaceId: string | undefined }) {
    const t = useTranslations('contracts');
    const te = useTranslations('enums');
    const fmt = useFormat();
    const customer = useCustomer(contract.customerId);
    const customerName = contract.customerSnapshot?.name ?? (customer.data !== undefined ? (customer.data.nameTh !== '' ? customer.data.nameTh : customer.data.nameEn) : '–');
    const live = contract.status === 'signed' || contract.status === 'completed';

    return (
        <>
            <SectionCard
                title={(
                    <span className="inline-flex flex-wrap items-center gap-2">
                        <DocumentNumberTag number={contract.number} />
                        <StatusTag enumName="contractStatus" value={contract.status} tones={CONTRACT_STATUS_TONES} />
                        <span className="break-words">{contract.title}</span>
                    </span>
                )}
                extra={(
                    <div className="flex flex-wrap gap-2">
                        <a href={contractPrintHref(contract.id)} target="_blank" rel="noopener noreferrer">
                            <Button icon={<PrinterOutlined />}>{t('actions.print')}</Button>
                        </a>
                        {canManage && <ContractActions contract={contract} />}
                    </div>
                )}
            >
                <Descriptions size="small" column={{ xs: 1, md: 2, xl: 3 }} bordered>
                    <Descriptions.Item label={t('fields.customer')}>{customerName}</Descriptions.Item>
                    <Descriptions.Item label={t('fields.originalValue')}><MoneyText value={contract.originalValue} currency /></Descriptions.Item>
                    <Descriptions.Item label={t('fields.currentValue')}><MoneyText value={contract.currentValue} currency /></Descriptions.Item>
                    <Descriptions.Item label={t('fields.signDate')}><DateText value={contract.signDate} /></Descriptions.Item>
                    <Descriptions.Item label={t('fields.startDate')}><DateText value={contract.startDate} /></Descriptions.Item>
                    <Descriptions.Item label={t('fields.finishDate')}>
                        <DateText value={contract.finishDate} />
                        {contract.extensionDays > 0 && <Tag className="!ml-2">{t('detail.extension', { days: contract.extensionDays })}</Tag>}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('fields.billingMode')}>{te(`billingMode.${contract.billingMode}`)}</Descriptions.Item>
                    <Descriptions.Item label={t('fields.vatRate')}>{fmt.percent(contract.vatRate)}</Descriptions.Item>
                    {contract.quotedMarginPct !== undefined && contract.quotedMarginPct !== null && (
                        <Descriptions.Item label={t('fields.quotedMargin')}>{fmt.percent(contract.quotedMarginPct)}</Descriptions.Item>
                    )}
                    {contract.progress !== null && (
                        <Descriptions.Item label={t('fields.progress')}><Progress percent={Math.round(contract.progress * 1000) / 10} size="small" /></Descriptions.Item>
                    )}
                    {contract.completedAt !== null && <Descriptions.Item label={t('fields.completedAt')}><DateText value={contract.completedAt} /></Descriptions.Item>}
                    {contract.closedAt !== null && <Descriptions.Item label={t('fields.closedAt')}><DateText value={contract.closedAt} /></Descriptions.Item>}
                    {contract.terminatedAt !== null && (
                        <Descriptions.Item label={t('fields.terminatedAt')}><DateText value={contract.terminatedAt} />{contract.terminationReason !== '' ? ` · ${contract.terminationReason}` : ''}</Descriptions.Item>
                    )}
                </Descriptions>
            </SectionCard>

            <SectionCard title={t('detail.termsTitle')}>
                <TermsForm contract={contract} disabled />
            </SectionCard>
            <SectionCard title={t('detail.milestonesTitle')}>
                <MilestonesReadOnly contract={contract} />
            </SectionCard>
            {live || contract.status === 'closed' ? (
                <GuaranteesCard contract={contract} canManage={canManage} workspaceId={workspaceId} />
            ) : null}
            {contract.status !== 'cancelled' && contract.status !== 'terminated' && contract.status !== 'draft' && (
                <SignedScans contract={contract} canManage={canManage} workspaceId={workspaceId} />
            )}
        </>
    );
}

function ContractActions({ contract }: { contract: MainContractDto }) {
    const t = useTranslations('contracts');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const close = useCloseContract(contract.id);
    const terminate = useTerminateContract(contract.id);
    const [reason, setReason] = useState<string | null>(null);

    return (
        <>
            {contract.status === 'completed' && (
                <ConfirmAction title={t('actions.closeConfirm')} onConfirm={() => close.mutateAsync({})}>{t('actions.close')}</ConfirmAction>
            )}
            {contract.status === 'signed' && <Button danger onClick={() => setReason('')}>{t('actions.terminate')}</Button>}
            <Modal open={reason !== null} title={t('terminate.title')} okText={t('terminate.submit')} okButtonProps={{ danger: true, disabled: (reason ?? '').trim() === '' }}
                confirmLoading={terminate.isPending} onCancel={() => setReason(null)} destroyOnHidden
                onOk={() => {
                    terminate.mutateAsync({ reason: (reason ?? '').trim() })
                        .then(() => { setReason(null); void message.success(t('terminate.done')); })
                        .catch((e: unknown) => { void message.error(toText(e)); });
                }}>
                <div className="mb-2 text-[13px] text-gray-500">{t('terminate.hint')}</div>
                <Input.TextArea rows={3} maxLength={2000} value={reason ?? ''} placeholder={t('terminate.reason')} onChange={e => setReason(e.target.value)} />
            </Modal>
        </>
    );
}

function SignedScans({ contract, canManage, workspaceId }: { contract: MainContractDto; canManage: boolean; workspaceId: string | undefined }) {
    const t = useTranslations('contracts');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const add = useAddSignedScan(contract.id);
    const [uploading, setUploading] = useState(false);

    const upload = async (file: File) => {
        if (workspaceId === undefined) return;
        const problem = uploadProblem(file);
        if (problem !== null) {
            void message.error(problem === 'tooLarge' ? t('scans.tooLarge') : t('scans.badType'));
            return;
        }
        setUploading(true);
        try {
            const dto = await uploadErpFile(file, 'main_contract_scan', workspaceId);
            await add.mutateAsync({ fileIds: [dto.id] });
            void message.success(t('scans.added'));
        } catch (e) {
            void message.error(toText(e));
        } finally {
            setUploading(false);
        }
    };

    return (
        <SectionCard title={t('scans.title')}>
            <div className="flex flex-col gap-3">
                <FileAttachments purpose="main_contract_scan" workspaceId={workspaceId} value={contract.signedScans} readOnly emptyText={t('scans.empty')} />
                {canManage && (
                    <div>
                        <Upload accept={ALLOWED_CONTENT_TYPES.join(',')} showUploadList={false} disabled={workspaceId === undefined}
                            beforeUpload={file => { void upload(file); return Upload.LIST_IGNORE; }}>
                            <Button icon={<UploadOutlined />} loading={uploading}>{t('scans.upload')}</Button>
                        </Upload>
                    </div>
                )}
            </div>
        </SectionCard>
    );
}
