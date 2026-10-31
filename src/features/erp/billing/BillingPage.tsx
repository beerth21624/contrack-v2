'use client';

// ─── /p/[projectId]/billing: claims, advance, retention and invoices of the project's contract ───
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, App, Button, Input, Modal, Select, Skeleton, Table } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useTranslations } from 'next-intl';
import { AR_CLAIM_OPEN_STATUSES, can, type ArClaimSummaryDto, type CreateArClaimRequest, type MainContractDto } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useFormat } from '@/i18n/useFormat';
import { useProjectContract } from '../contracts/hooks';
import { useHubProject } from '../hub/hooks';
import { DateText } from '../shared/DateText';
import { EmptyState } from '../shared/EmptyState';
import { MoneyText } from '../shared/MoneyText';
import { SectionCard } from '../shared/SectionCard';
import { StatusTag } from '../shared/StatusTag';
import { useErpWorkspace } from '../shared/useErpWorkspace';
import { AdvanceCard } from './AdvanceCard';
import { InvoicesTable } from './InvoicesTable';
import { RetentionCard } from './RetentionCard';
import { useClaims, useCreateClaim } from './hooks';
import { CLAIM_STATUS_TONES, claimHref } from './status';

export function BillingPage({ projectId }: { projectId: string }) {
    const t = useTranslations('billing');
    const toText = useErrorMessage();
    const q = useProjectContract(projectId);
    const hub = useHubProject(projectId);
    const ws = useErpWorkspace(hub.data?.project.workspaceId);

    if (q.isLoading) return <Skeleton active />;
    if (q.isError || q.data === undefined) {
        return (
            <Alert type="error" showIcon title={`${t('loadFailed')}: ${toText(q.error)}`}
                action={<Button size="small" onClick={() => { void q.refetch(); }}>{t('retry')}</Button>} />
        );
    }
    const contract = q.data.contract;
    if (contract === null || contract.status === 'draft' || contract.status === 'cancelled' || contract.status === 'terminated') {
        return (
            <SectionCard>
                <EmptyState title={t('noContract.title')} hint={t('noContract.hint')}
                    action={<Link href={`/p/${encodeURIComponent(projectId)}/contract`}><Button>{t('noContract.open')}</Button></Link>} />
            </SectionCard>
        );
    }
    const canManage = can(ws.role, 'billing.manage');

    return (
        <div className="flex min-w-0 flex-col gap-4">
            <AdvanceCard contract={contract} />
            <ClaimsSection contract={contract} canManage={canManage} />
            <RetentionCard contract={contract} canManage={canManage} />
            <InvoicesTable projectId={projectId} workspaceId={ws.workspaceId} role={ws.role} />
        </div>
    );
}

function ClaimsSection({ contract, canManage }: { contract: MainContractDto; canManage: boolean }) {
    const t = useTranslations('billing');
    const q = useClaims(contract.id);
    const [open, setOpen] = useState(false);
    const claims = q.data ?? [];
    const hasOpen = claims.some(c => AR_CLAIM_OPEN_STATUSES.includes(c.status));
    const mayCreate = canManage && contract.status === 'signed' && !hasOpen;

    const columns: ColumnsType<ArClaimSummaryDto> = [
        { key: 'no', title: t('claims.no'), render: (_, c) => <Link href={claimHref(c.projectId, c.id)}>{t('claims.claimNo', { no: c.claimNo })}</Link> },
        { key: 'period', title: t('claims.period'), render: (_, c) => (c.periodFrom === null && c.periodTo === null ? '–' : <span><DateText value={c.periodFrom} /> – <DateText value={c.periodTo} /></span>) },
        { key: 'status', title: t('fields.status'), render: (_, c) => <StatusTag enumName="claimStatus" value={c.status} tones={CLAIM_STATUS_TONES} /> },
        { key: 'work', title: t('claims.workValue'), align: 'right', render: (_, c) => <MoneyText value={c.workValue} /> },
        { key: 'cum', title: t('claims.cumulative'), align: 'right', render: (_, c) => <MoneyText value={c.cumulativeValue} /> },
        { key: 'payable', title: t('fields.payable'), align: 'right', render: (_, c) => <MoneyText value={c.payable} /> },
    ];

    return (
        <SectionCard title={t('claims.title')}
            extra={mayCreate ? <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>{t('claims.new')}</Button> : undefined}>
            {hasOpen && <Alert className="!mb-3" type="info" showIcon title={t('claims.openHint')} />}
            <Table<ArClaimSummaryDto> size="small" rowKey="id" columns={columns} dataSource={claims} loading={q.isLoading} pagination={false}
                scroll={{ x: 'max-content' }} locale={{ emptyText: t('claims.empty') }} />
            {open && <NewClaimDialog contract={contract} onClose={() => setOpen(false)} />}
        </SectionCard>
    );
}

function NewClaimDialog({ contract, onClose }: { contract: MainContractDto; onClose: () => void }) {
    const t = useTranslations('billing');
    const fmt = useFormat();
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const router = useRouter();
    const create = useCreateClaim(contract.id);
    const byMilestone = contract.billingMode === 'milestone';
    const claimable = contract.milestones.filter(m => m.kind !== 'advance' && m.no > 0 && m.status === 'claimable');
    const [milestoneId, setMilestoneId] = useState<string | undefined>(claimable[0]?.id);
    const [periodFrom, setPeriodFrom] = useState('');
    const [periodTo, setPeriodTo] = useState('');
    const datesBad = periodFrom !== '' && periodTo !== '' && periodTo < periodFrom;

    const submit = async () => {
        const body: CreateArClaimRequest = {
            ...(byMilestone && milestoneId !== undefined ? { milestoneId } : {}),
            ...(periodFrom !== '' ? { periodFrom } : {}),
            ...(periodTo !== '' ? { periodTo } : {}),
        };
        try {
            const claim = await create.mutateAsync(body);
            void message.success(t('claims.created'));
            router.push(claimHref(claim.projectId, claim.id));
        } catch (e) {
            void message.error(toText(e));
        }
    };

    return (
        <Modal open title={t('claims.newTitle')} okText={t('claims.create')} confirmLoading={create.isPending}
            okButtonProps={{ disabled: datesBad || (byMilestone && milestoneId === undefined) }}
            onCancel={onClose} onOk={() => { void submit(); }} destroyOnHidden>
            <div className="flex flex-col gap-3">
                {byMilestone && (
                    claimable.length === 0 ? <Alert type="warning" showIcon title={t('claims.noClaimable')} /> : (
                        <label className="flex flex-col gap-1 text-[13px] text-gray-600">{t('claims.milestone')}
                            <Select value={milestoneId} onChange={setMilestoneId}
                                options={claimable.map(m => ({
                                    value: m.id,
                                    label: `${m.no}. ${fmt.locale === 'th' ? (m.labelTh !== '' ? m.labelTh : m.labelEn) : (m.labelEn !== '' ? m.labelEn : m.labelTh)} · ${fmt.money(m.amount)}`,
                                }))} />
                        </label>
                    )
                )}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="flex flex-col gap-1 text-[13px] text-gray-600">{t('claims.periodFrom')}
                        <Input type="date" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)} />
                    </label>
                    <label className="flex flex-col gap-1 text-[13px] text-gray-600">{t('claims.periodTo')}
                        <Input type="date" value={periodTo} onChange={e => setPeriodTo(e.target.value)} />
                    </label>
                </div>
                {datesBad && <div className="text-[13px] text-red-600">{t('claims.datesOrder')}</div>}
            </div>
        </Modal>
    );
}
