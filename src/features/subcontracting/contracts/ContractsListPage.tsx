'use client';

// ─── /subcontracting/contracts: contracts of the open cloud project, one call to action per row ───
import Link from 'next/link';
import { Button, Empty, Table } from 'antd';
import type { SubcontractSummaryDto } from '@/shared/contract';
import { tradeLabel } from '@/domain/subcontracting/trades';
import { spinner } from '@/features/cloud/ui/common';
import { useSubcontracts } from './api';
import { PENDING_ACTION_LABEL, isBuyerMove } from './logic';
import { CARD, LoadError, Money, NeedProject, PageFrame, PricesHiddenProvider, StatusTag, useBuyerRights, useOpenProject } from './ui';

export function ContractsListPage() {
    const project = useOpenProject();
    if (project === null) return <PageFrame title="สัญญาจ้างช่วง"><NeedProject what="สัญญาจ้างช่วงของโครงการ" /></PageFrame>;
    return <ContractsList projectId={project.projectId} workspaceId={project.workspaceId} projectName={project.name} />;
}

function ContractsList({ projectId, workspaceId, projectName }: { projectId: string; workspaceId: string; projectName: string }) {
    const q = useSubcontracts(projectId);
    const rights = useBuyerRights(workspaceId);
    const rows = q.data ?? [];
    const totals = rows
        .filter(r => r.status !== 'cancelled')
        .reduce((t, r) => ({ total: t.total + r.total, paid: t.paid + r.paidTotal, retention: t.retention + r.retentionBalance }), { total: 0, paid: 0, retention: 0 });

    return (
        <PricesHiddenProvider hidden={!rights.loading && !rights.may('sc.readPrices')}>
        <PageFrame
            title="สัญญาจ้างช่วง"
            subtitle={projectName}
            extra={<>
                <Link href="/subcontracting/report"><Button>ประมาณการเทียบจริง</Button></Link>
                <Link href="/subcontracting/retention"><Button>เงินประกันผลงาน</Button></Link>
            </>}
        >
            {q.isLoading ? spinner : q.isError ? <LoadError error={q.error} /> : (
                <div className={`${CARD} p-0 overflow-hidden`}>
                    <Table<SubcontractSummaryDto>
                        rowKey="id"
                        dataSource={rows}
                        pagination={false}
                        scroll={{ x: 960 }}
                        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ยังไม่มีสัญญา — ตกลงจ้างจากตารางเทียบราคาแล้วสัญญาจะมาอยู่ที่นี่" /> }}
                        columns={[
                            {
                                title: 'เลขที่', dataIndex: 'contractNo', width: 120,
                                render: (_v, r) => <Link href={`/subcontracting/contracts/${r.id}`} className="font-medium">{r.contractNo}</Link>,
                            },
                            {
                                title: 'ผู้รับจ้าง / งาน',
                                render: (_v, r) => (
                                    <div className="min-w-0">
                                        <div className="text-gray-900">{r.vendorName}</div>
                                        <div className="text-[12px] text-gray-500">{tradeLabel(r.trade)} · {r.title}</div>
                                    </div>
                                ),
                            },
                            { title: 'สถานะ', dataIndex: 'status', width: 150, render: (_v, r) => <StatusTag status={r.status} /> },
                            { title: 'มูลค่าสัญญา', dataIndex: 'total', width: 130, align: 'right', render: (v: number) => <Money value={v} /> },
                            { title: 'จ่ายแล้ว', dataIndex: 'paidTotal', width: 130, align: 'right', render: (v: number) => <Money value={v} /> },
                            { title: 'ประกันผลงานคงค้าง', dataIndex: 'retentionBalance', width: 140, align: 'right', render: (v: number) => <Money value={v} /> },
                            {
                                title: '', width: 150, align: 'right',
                                render: (_v, r) => {
                                    const label = PENDING_ACTION_LABEL[r.pendingAction];
                                    if (label === null) return null;
                                    if (!isBuyerMove(r.pendingAction)) return <span className="text-[12px] text-gray-500">{label}</span>;
                                    return <Link href={`/subcontracting/contracts/${r.id}`}><Button size="small" type="primary">{label}</Button></Link>;
                                },
                            },
                        ]}
                        summary={() => rows.length === 0 ? null : (
                            <Table.Summary.Row className="font-semibold">
                                <Table.Summary.Cell index={0} colSpan={3}>รวม (ไม่นับที่ยกเลิก)</Table.Summary.Cell>
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
