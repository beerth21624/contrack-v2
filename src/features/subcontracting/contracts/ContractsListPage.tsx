'use client';

// ─── /subcontracting/contracts: contracts of the open cloud project, one call to action per row ───
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button, Empty, Table } from 'antd';
import type { SubcontractSummaryDto } from '@/shared/contract';
import { tradeName } from '../buyer/format';
import { spinner } from '@/features/cloud/ui/common';
import { useSubcontracts } from './api';
import { isBuyerMove, pendingActionLabel } from './logic';
import { CARD, LoadError, Money, NeedProject, PageFrame, PricesHiddenProvider, StatusTag, useBuyerRights, useOpenProject } from './ui';

export function ContractsListPage() {
    const t = useTranslations('subcontracting');
    const project = useOpenProject();
    if (project === null) return <PageFrame title={t('contracts.list.title')}><NeedProject what={t('contracts.ui.whatContracts')} /></PageFrame>;
    return <ContractsList projectId={project.projectId} workspaceId={project.workspaceId} projectName={project.name} />;
}

function ContractsList({ projectId, workspaceId, projectName }: { projectId: string; workspaceId: string; projectName: string }) {
    const t = useTranslations('subcontracting');
    const q = useSubcontracts(projectId);
    const rights = useBuyerRights(workspaceId);
    const rows = q.data ?? [];
    const totals = rows
        .filter(r => r.status !== 'cancelled')
        .reduce((t, r) => ({ total: t.total + r.total, paid: t.paid + r.paidTotal, retention: t.retention + r.retentionBalance }), { total: 0, paid: 0, retention: 0 });

    return (
        <PricesHiddenProvider hidden={!rights.loading && !rights.may('sc.readPrices')}>
        <PageFrame
            title={t('contracts.list.title')}
            subtitle={projectName}
            extra={<>
                <Link href="/subcontracting/report"><Button>{t('contracts.list.estimateVsActual')}</Button></Link>
                <Link href="/subcontracting/retention"><Button>{t('contracts.list.retention')}</Button></Link>
            </>}
        >
            {q.isLoading ? spinner : q.isError ? <LoadError error={q.error} /> : (
                <div className={`${CARD} p-0 overflow-hidden`}>
                    <Table<SubcontractSummaryDto>
                        rowKey="id"
                        dataSource={rows}
                        pagination={false}
                        scroll={{ x: 960 }}
                        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('contracts.list.empty')} /> }}
                        columns={[
                            {
                                title: t('contracts.list.colNo'), dataIndex: 'contractNo', width: 120,
                                render: (_v, r) => <Link href={`/subcontracting/contracts/${r.id}`} className="font-medium">{r.contractNo}</Link>,
                            },
                            {
                                title: t('contracts.list.colContractorJob'),
                                render: (_v, r) => (
                                    <div className="min-w-0">
                                        <div className="text-gray-900">{r.vendorName}</div>
                                        <div className="text-[12px] text-gray-500">{tradeName(r.trade, t)} · {r.title}</div>
                                    </div>
                                ),
                            },
                            { title: t('contracts.list.colStatus'), dataIndex: 'status', width: 150, render: (_v, r) => <StatusTag status={r.status} /> },
                            { title: t('contracts.list.colValue'), dataIndex: 'total', width: 130, align: 'right', render: (v: number) => <Money value={v} /> },
                            { title: t('contracts.list.colPaid'), dataIndex: 'paidTotal', width: 130, align: 'right', render: (v: number) => <Money value={v} /> },
                            { title: t('contracts.list.colRetention'), dataIndex: 'retentionBalance', width: 140, align: 'right', render: (v: number) => <Money value={v} /> },
                            {
                                title: '', width: 150, align: 'right',
                                render: (_v, r) => {
                                    const label = pendingActionLabel(r.pendingAction, t);
                                    if (label === null) return null;
                                    if (!isBuyerMove(r.pendingAction)) return <span className="text-[12px] text-gray-500">{label}</span>;
                                    return <Link href={`/subcontracting/contracts/${r.id}`}><Button size="small" type="primary">{label}</Button></Link>;
                                },
                            },
                        ]}
                        summary={() => rows.length === 0 ? null : (
                            <Table.Summary.Row className="font-semibold">
                                <Table.Summary.Cell index={0} colSpan={3}>{t('contracts.list.total')}</Table.Summary.Cell>
                                <Table.Summary.Cell index={3} align="right"><Money value={totals.total} /></Table.Summary.Cell>
                                <Table.Summary.Cell index={4} align="right"><Money value={totals.paid} /></Table.Summary.Cell>
                                <Table.Summary.Cell index={5} align="right"><Money value={totals.retention} /></Table.Summary.Cell>
                                <Table.Summary.Cell index={6} />
                            </Table.Summary.Row>
                        )}
                    />
                </div>
            )}
        </PageFrame>
        </PricesHiddenProvider>
    );
}
