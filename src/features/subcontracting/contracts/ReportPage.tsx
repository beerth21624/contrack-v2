'use client';

// ─── /subcontracting/report: labour estimate (BOQ) vs contracted vs paid, per trade, for the open project (plan §4.8) ───
import { useState } from 'react';
import { App, Button, Result, Table } from 'antd';
import { FileExcelOutlined } from '@ant-design/icons';
import { thaiErrorMessage } from '@/features/cloud/api/errors';
import { spinner } from '@/features/cloud/ui/common';
import { useProcurementReport } from './api';
import { fmtPct } from './logic';
import { downloadReportXlsx, reportRows, type ReportRow } from './report-sheet';
import { CARD, LoadError, Money, NeedProject, PageFrame, useBuyerRights, useOpenProject } from './ui';

export function ReportPage() {
    const project = useOpenProject();
    if (project === null) return <PageFrame title="ประมาณการเทียบจริง"><NeedProject what="รายงานประมาณการเทียบจริง" /></PageFrame>;
    return <Report projectId={project.projectId} workspaceId={project.workspaceId} projectName={project.name} />;
}

function Report({ projectId, workspaceId, projectName }: { projectId: string; workspaceId: string; projectName: string }) {
    const { message } = App.useApp();
    const rights = useBuyerRights(workspaceId);
    const allowed = rights.may('sc.readPrices');
    const q = useProcurementReport(projectId, allowed);
    const [exporting, setExporting] = useState(false);

    if (rights.loading) return spinner;
    if (!allowed) {
        return <PageFrame title="ประมาณการเทียบจริง"><Result status="403" title="ไม่มีสิทธิ์ดูราคา" subTitle="ขอให้เจ้าของหรือผู้ดูแลเปิดสิทธิ์ในตั้งค่าจ้างช่วง" /></PageFrame>;
    }

    const report = q.data;
    const rows = report === undefined ? [] : reportRows(report);
    const body = rows.slice(0, -1);
    const total = rows[rows.length - 1];

    const onExport = async () => {
        if (report === undefined) return;
        setExporting(true);
        try {
            await downloadReportXlsx(report, projectName);
        } catch (e) {
            void message.error(thaiErrorMessage(e));
        } finally {
            setExporting(false);
        }
    };

    return (
        <PageFrame
            title="ประมาณการเทียบจริง"
            subtitle={`${projectName} · ค่าแรงประเมินจาก BOQ เทียบราคาสัญญาและยอดจ่ายจริง`}
            extra={<Button icon={<FileExcelOutlined />} disabled={report === undefined} loading={exporting} onClick={() => { void onExport(); }}>ส่งออก Excel</Button>}
        >
            {q.isLoading ? spinner : q.isError ? <LoadError error={q.error} /> : (
                <div className={`${CARD} overflow-hidden`}>
                    <Table<ReportRow>
                        rowKey="key"
                        dataSource={body}
                        pagination={false}
                        scroll={{ x: 820 }}
                        columns={[
                            { title: 'ประเภทงาน', dataIndex: 'label' },
                            { title: 'ประมาณการ (BOQ)', dataIndex: 'estimate', width: 150, align: 'right', render: (v: number) => <Money value={v} /> },
                            { title: 'ราคาสัญญา', dataIndex: 'contracted', width: 150, align: 'right', render: (v: number) => (v === 0 ? <span className="text-gray-400">—</span> : <Money value={v} />) },
                            { title: 'จ่ายแล้ว', dataIndex: 'paid', width: 150, align: 'right', render: (v: number) => <Money value={v} /> },
                            { title: 'ต่าง', dataIndex: 'diff', width: 170, align: 'right', render: (_v, r) => <Diff row={r} /> },
                        ]}
                        summary={() => total === undefined ? null : (
                            <Table.Summary.Row className="font-semibold">
                                <Table.Summary.Cell index={0}>{total.label}</Table.Summary.Cell>
                                <Table.Summary.Cell index={1} align="right"><Money value={total.estimate} /></Table.Summary.Cell>
                                <Table.Summary.Cell index={2} align="right"><Money value={total.contracted} /></Table.Summary.Cell>
                                <Table.Summary.Cell index={3} align="right"><Money value={total.paid} /></Table.Summary.Cell>
                                <Table.Summary.Cell index={4} align="right"><Diff row={total} /></Table.Summary.Cell>
                            </Table.Summary.Row>
                        )}
                    />
                </div>
            )}
        </PageFrame>
    );
}

/** Over the estimate = red (a problem), under = plain; no contract yet = nothing to compare. */
function Diff({ row }: { row: ReportRow }) {
    if (row.contracted === 0) return <span className="text-gray-400">—</span>;
    const over = row.diff > 0;
    return (
        <span className={over ? 'text-red-600' : ''}>
            <Money value={row.diff} />
            {row.diffPct !== null && <span className="text-[12px] ml-1 tabular-nums">({over ? '+' : ''}{fmtPct(row.diffPct)})</span>}
        </span>
    );
}
