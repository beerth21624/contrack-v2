'use client';

// ─── /subcontracting/retention: retention still held across every project of the workspace, soonest due first ───
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Empty, Table } from 'antd';
import type { WorkspaceRetentionRow } from '@/shared/contract';
import { useCurrentWorkspace } from '@/features/cloud/query/hooks';
import { spinner } from '@/features/cloud/ui/common';
import { useWorkspaceRetention } from './api';
import { fmtDate, isOverdue, sortRetentionRows, todayIso } from './logic';
import { CARD, LoadError, Money, PageFrame, PricesHiddenProvider, StatusTag, useBuyerRights } from './ui';

export function RetentionPage() {
    const t = useTranslations('subcontracting');
    const { workspace, isLoading } = useCurrentWorkspace();
    const q = useWorkspaceRetention(workspace?.id);
    const rights = useBuyerRights(workspace?.id);
    if (isLoading) return spinner;
    const pricesHidden = !rights.loading && !rights.may('sc.readPrices');
    // Without sc.readPrices every balance comes as 0: keep the rows (who still holds retention), show "—" for money.
    const rows = sortRetentionRows(q.data ?? [], { keepZero: pricesHidden });
    const total = rows.reduce((s, r) => s + r.balance, 0);
    const today = todayIso();

    return (
        <PricesHiddenProvider hidden={pricesHidden}>
        <PageFrame
            title={t('contracts.retentionPage.title')}
            subtitle={workspace === undefined ? undefined : t('contracts.retentionPage.subtitle', { name: workspace.name })}
            extra={rows.length > 0 ? <div className="text-right"><div className="text-secondary text-gray-600">{t('contracts.retentionPage.totalHeld')}</div><div className="text-card-title font-semibold"><Money value={total} /></div></div> : undefined}
        >
            {q.isLoading ? spinner : q.isError ? <LoadError error={q.error} /> : (
                <div className={`${CARD} overflow-hidden`}>
                    <Table<WorkspaceRetentionRow>
                        rowKey="subcontractId"
                        dataSource={rows}
                        pagination={rows.length > 50 ? { pageSize: 50 } : false}
                        scroll={{ x: 820 }}
                        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('contracts.retentionPage.empty')} /> }}
                        columns={[
                            {
                                title: t('contracts.retentionPage.colDue'), dataIndex: 'nextDueAt', width: 130,
                                render: (v: string | null) => (v === null
                                    ? <span className="text-gray-400">{t('contracts.retentionPage.notScheduled')}</span>
                                    : <span className={isOverdue(v, today) ? 'text-red-600 font-medium' : ''}>{fmtDate(v)}</span>),
                            },
                            {
                                title: t('contracts.retentionPage.colContract'), dataIndex: 'contractNo', width: 130,
                                render: (_v, r) => <Link href={`/subcontracting/contracts/${r.subcontractId}`}>{r.contractNo}</Link>,
                            },
                            { title: t('contracts.retentionPage.colProject'), dataIndex: 'projectName' },
                            { title: t('contracts.retentionPage.colContractor'), dataIndex: 'vendorName' },
                            { title: t('contracts.retentionPage.colStatus'), dataIndex: 'status', width: 150, render: (_v, r) => <StatusTag status={r.status} /> },
                            { title: t('contracts.retentionPage.colHeld'), dataIndex: 'balance', width: 140, align: 'right', render: (v: number) => <Money value={v} /> },
                        ]}
                    />
                </div>
            )}
        </PageFrame>
        </PricesHiddenProvider>
    );
}
