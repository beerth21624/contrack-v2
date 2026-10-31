'use client';

// ─── Approvals inbox: requests waiting for me (decide with a note) and the history of all requests ───
import { useState } from 'react';
import { Alert, App, Button, Input, Modal, Result, Select, Table, Tabs } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslations } from 'next-intl';
import { type ApprovalDecision, type ApprovalRequestDto, type ApprovalStatus, APPROVAL_STATUSES } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { DateText } from '../shared/DateText';
import { EmptyState } from '../shared/EmptyState';
import { ErpPage } from '../shared/ErpPage';
import { MoneyText } from '../shared/MoneyText';
import { SectionCard } from '../shared/SectionCard';
import { StatusTag } from '../shared/StatusTag';
import { useErpWorkspace } from '../shared/useErpWorkspace';
import { AuditTimeline } from '../shared/AuditTimeline';
import { useApprovalList, useDecideApproval } from './hooks';

type View = 'mine' | 'all';

export function ApprovalsInboxPage() {
    const t = useTranslations('approvals');
    const ws = useErpWorkspace();
    const [view, setView] = useState<View>('mine');

    return (
        <ErpPage title={t('inbox.title')} subtitle={t('inbox.subtitle')}>
            {ws.isSolo && <Alert type="info" showIcon title={t('inbox.solo')} />}
            <Tabs
                activeKey={view}
                onChange={k => setView(k as View)}
                items={[
                    { key: 'mine', label: t('inbox.tabs.mine'), children: ws.workspaceId === undefined ? null : <RequestTable workspaceId={ws.workspaceId} mine /> },
                    { key: 'all', label: t('inbox.tabs.all'), children: ws.workspaceId === undefined ? null : <RequestTable workspaceId={ws.workspaceId} mine={false} /> },
                ]}
            />
            <AuditTimeline entityType="approval_request" title={t('inbox.history')} />
        </ErpPage>
    );
}

function RequestTable({ workspaceId, mine }: { workspaceId: string; mine: boolean }) {
    const t = useTranslations('approvals');
    const tRoles = useTranslations('roles');
    const tEnums = useTranslations('enums');
    const toText = useErrorMessage();
    const [status, setStatus] = useState<ApprovalStatus | undefined>();
    const [deciding, setDeciding] = useState<{ row: ApprovalRequestDto; decision: ApprovalDecision } | undefined>();
    const list = useApprovalList(workspaceId, { mine, status: mine ? undefined : status });
    const rows = list.data?.pages.flatMap(p => p.items) ?? [];

    const columns: ColumnsType<ApprovalRequestDto> = [
        {
            title: t('columns.request'), key: 'request',
            render: (_v, r) => (
                <div className="min-w-0">
                    <div className="font-medium text-gray-900 break-words">{r.title}</div>
                    <div className="text-[12px] text-gray-500">{tEnums(`approvalSubject.${r.subject}`)}</div>
                </div>
            ),
        },
        { title: t('columns.amount'), dataIndex: 'amount', key: 'amount', align: 'right', render: (v: number | null) => <MoneyText value={v} /> },
        {
            title: t('columns.requestedBy'), key: 'by', responsive: ['md'],
            render: (_v, r) => (
                <div className="min-w-0">
                    <div className="break-words">{r.requestedByName ?? '–'}</div>
                    <div className="text-[12px] text-gray-500"><DateText value={r.requestedAt} style="dateTime" /></div>
                </div>
            ),
        },
        {
            title: t('columns.status'), key: 'status',
            render: (_v, r) => (
                <div className="flex flex-col gap-1 items-start">
                    <StatusTag enumName="approvalStatus" value={r.status} />
                    {r.auto && r.autoReason !== null && <span className="text-[12px] text-gray-500">{tEnums(`approvalAutoReason.${r.autoReason}`)}</span>}
                </div>
            ),
        },
        {
            title: t('columns.decision'), key: 'decision', responsive: ['lg'],
            render: (_v, r) => r.decidedAt === null ? (
                r.status === 'pending' && r.approverRoles.length > 0
                    ? <span className="text-gray-500">{t('waitingFor', { roles: r.approverRoles.map(x => tRoles(`${x}.label`)).join(', ') })}</span>
                    : '–'
            ) : (
                <div className="min-w-0">
                    <div className="break-words">{r.decidedByName ?? '–'} · <DateText value={r.decidedAt} style="dateTime" /></div>
                    {r.decisionNote !== '' && <div className="text-[12px] text-gray-500 break-words">{r.decisionNote}</div>}
                </div>
            ),
        },
        {
            title: '', key: 'actions', align: 'right',
            render: (_v, r) => r.status === 'pending' && r.canDecide ? (
                <div className="flex gap-2 justify-end flex-wrap">
                    <Button size="small" type="primary" onClick={() => setDeciding({ row: r, decision: 'approved' })}>{t('actions.approve')}</Button>
                    <Button size="small" danger onClick={() => setDeciding({ row: r, decision: 'rejected' })}>{t('actions.reject')}</Button>
                </div>
            ) : null,
        },
    ];

    return (
        <SectionCard
            extra={mine ? undefined : (
                <Select<ApprovalStatus | 'all'>
                    value={status ?? 'all'}
                    onChange={v => setStatus(v === 'all' ? undefined : v)}
                    style={{ minWidth: 160 }}
                    aria-label={t('columns.status')}
                    options={[
                        { value: 'all', label: t('filterAll') },
                        ...APPROVAL_STATUSES.map(s => ({ value: s, label: tEnums(`approvalStatus.${s}`) })),
                    ]}
                />
            )}
        >
            {list.isError ? (
                <Result status="warning" title={t('loadFailed')} subTitle={toText(list.error)}
                    extra={<Button onClick={() => { void list.refetch(); }}>{t('retry')}</Button>} />
            ) : (
                <>
                    <Table<ApprovalRequestDto>
                        rowKey="id"
                        size="middle"
                        loading={list.isLoading}
                        columns={columns}
                        dataSource={rows}
                        pagination={false}
                        scroll={{ x: 'max-content' }}
                        locale={{ emptyText: <EmptyState title={mine ? t('inbox.emptyMine') : t('inbox.emptyAll')} /> }}
                    />
                    {list.hasNextPage && (
                        <div className="mt-3 text-center">
                            <Button loading={list.isFetchingNextPage} onClick={() => { void list.fetchNextPage(); }}>{t('loadMore')}</Button>
                        </div>
                    )}
                </>
            )}
            {deciding !== undefined && (
                <DecideDialog workspaceId={workspaceId} target={deciding} onClose={() => setDeciding(undefined)} />
            )}
        </SectionCard>
    );
}

function DecideDialog({ workspaceId, target, onClose }: {
    workspaceId: string;
    target: { row: ApprovalRequestDto; decision: ApprovalDecision };
    onClose: () => void;
}) {
    const t = useTranslations('approvals');
    const tc = useTranslations('common');
    const { message } = App.useApp();
    const toText = useErrorMessage();
    const decide = useDecideApproval(workspaceId);
    const [note, setNote] = useState('');
    const approve = target.decision === 'approved';

    const submit = async () => {
        try {
            await decide.mutateAsync({ requestId: target.row.id, decision: target.decision, note: note.trim() });
            void message.success(approve ? t('messages.approved') : t('messages.rejected'));
            onClose();
        } catch (e) {
            void message.error(toText(e));
        }
    };

    return (
        <Modal
            open
            title={approve ? t('dialog.approveTitle') : t('dialog.rejectTitle')}
            onCancel={onClose}
            onOk={() => void submit()}
            okText={approve ? t('actions.approve') : t('actions.reject')}
            cancelText={tc('cancel')}
            okButtonProps={{ danger: !approve, loading: decide.isPending }}
            cancelButtonProps={{ disabled: decide.isPending }}
            destroyOnHidden
        >
            <div className="flex flex-col gap-3">
                <div>
                    <div className="font-medium text-gray-900 break-words">{target.row.title}</div>
                    <div className="text-gray-600"><MoneyText value={target.row.amount} currency /></div>
                </div>
                <div>
                    <div className="mb-1 text-gray-700">{t('dialog.note')}</div>
                    <Input.TextArea
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        maxLength={1000}
                        rows={3}
                        placeholder={t('dialog.notePlaceholder')}
                        aria-label={t('dialog.note')}
                    />
                </div>
            </div>
        </Modal>
    );
}
